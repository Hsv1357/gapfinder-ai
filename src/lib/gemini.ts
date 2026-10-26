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

export const GEMINI_MODEL = 'gemini-3.8-flash';
export const EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Generates vector embeddings for a given piece of text.
 * Standardized to 768 dimensions for pgvector compatibility.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getGeminiClient();
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.slice(0, 8000), // Protect against token limit overflow
      config: {
        outputDimensionality: 768,
      },
    });

    const vector = result.embeddings?.[0]?.values;
    if (!vector || vector.length === 0) {
      throw new Error('No embedding returned from Gemini API.');
    }
    return vector;
  } catch (error: any) {
    console.error('Error generating embedding with Gemini:', error);
    throw new Error(`Embedding generation failed: ${error?.message || 'Unknown error'}`);
  }
}

interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
}

/**
 * Calls Gemini text generation with error handling and retry.
 */
export async function generateText({
  prompt,
  systemInstruction,
  temperature = 0.2,
}: GenerateTextOptions): Promise<string> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response received from Gemini.');
  }
  return text;
}

/**
 * Generates structured JSON from Gemini, sanitizing markdown code fences.
 */
export async function generateStructuredJSON<T>({
  prompt,
  systemInstruction,
  temperature = 0.1,
}: GenerateTextOptions): Promise<T> {
  const rawText = await generateText({
    prompt: `${prompt}\n\nIMPORTANT: Return ONLY valid, raw JSON. Do not wrap in markdown tags or comments.`,
    systemInstruction,
    temperature,
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

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    console.error('Failed to parse Gemini JSON response:', cleaned);
    throw new Error(`Invalid JSON returned by Gemini: ${err.message}`);
  }
}
