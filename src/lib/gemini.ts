import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];

/**
 * Generates vector embeddings for a given piece of text.
 * Standardized to 768 dimensions for pgvector compatibility.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();
  const trimmed = text.slice(0, 8000); // Protect against token limit overflow

  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: trimmed,
        config: {
          outputDimensionality: 768,
          abortSignal: AbortSignal.timeout(12000),
        },
      });

      const vector = result.embeddings?.[0]?.values;
      if (!vector || vector.length === 0) {
        throw new Error('No embedding vector returned from Gemini API.');
      }
      return vector;
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        error?.status === 503 ||
        error?.status === 429 ||
        error?.name === 'AbortError' ||
        error?.message?.includes('503') ||
        error?.message?.includes('429');

      if (isRetryable && attempt < 3) {
        const delay = Math.min(2500, 400 * Math.pow(2, attempt) + Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  console.error('Error generating embedding with Gemini:', lastError);
  throw new Error(`Embedding generation failed: ${lastError?.message || 'Unknown error'}`);
}

/**
 * High-performance bounded-concurrency batch embedding generator.
 * Eliminates sequential network bottlenecks across document chunks.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  concurrency = 5
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < texts.length) {
      const currentIdx = nextIdx++;
      try {
        results[currentIdx] = await generateEmbedding(texts[currentIdx]);
      } catch (err) {
        console.warn(`Embedding failed for chunk index ${currentIdx}:`, err);
        results[currentIdx] = null;
      }
    }
  }

  const workerCount = Math.min(concurrency, texts.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Calls Gemini text generation with bounded retries, exponential backoff,
 * jitter, per-request timeouts, and resilient model fallback when 503 occurs.
 */
export async function generateText({
  prompt,
  systemInstruction,
  temperature = 0.2,
  timeoutMs = 15000,
}: GenerateTextOptions): Promise<string> {
  const ai = getGeminiClient();

  const candidateModels = [
    GEMINI_MODEL,
    ...FALLBACK_MODELS.filter((m) => m !== GEMINI_MODEL),
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature,
            abortSignal: AbortSignal.timeout(timeoutMs),
          },
        });

        const text = response.text;
        if (text && text.trim().length > 0) {
          return text;
        }
        throw new Error('Empty response received from Gemini.');
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const is503 =
          err?.status === 503 ||
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE');
        const is429 =
          err?.status === 429 ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED');
        const isTimeout =
          err?.name === 'AbortError' ||
          msg.includes('aborted') ||
          msg.includes('timeout');

        const isRetryable = is503 || is429 || isTimeout;

        // If retryable and have attempts left on this model, wait with jitter
        if (isRetryable && attempt < 2) {
          const jitter = Math.random() * 300;
          const backoff = 600 * Math.pow(2, attempt) + jitter;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          // Switch to next model in candidate cascade
          break;
        }
      }
    }
  }

  // If all models failed, throw descriptive error
  const finalMessage = lastError?.message || 'Gemini service temporarily unavailable.';
  throw new Error(finalMessage);
}

/**
 * Generates structured JSON from Gemini, sanitizing markdown code fences
 * and gracefully handling edge cases.
 */
export async function generateStructuredJSON<T>({
  prompt,
  systemInstruction,
  temperature = 0.1,
  timeoutMs = 18000,
}: GenerateTextOptions): Promise<T> {
  const rawText = await generateText({
    prompt: `${prompt}\n\nIMPORTANT: Return ONLY valid, raw JSON. Do not wrap in markdown tags or comments.`,
    systemInstruction,
    temperature,
    timeoutMs,
  });

  // Clean code fences if present
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // If text has non-JSON prefix or suffix, isolate JSON boundary
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    console.error('Failed to parse Gemini JSON response:', cleaned);
    throw new Error(`Invalid JSON returned by Gemini: ${err.message}`);
  }
}
