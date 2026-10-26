import { generateStructuredJSON } from '../gemini';
import { RetrievedChunk } from '../rag/retrieval';
import { QuestionType, Difficulty } from '@/types/database';

export interface GeneratedQuestionPayload {
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: Difficulty;
  citation_document_title: string;
  citation_page: number | null;
  citation_passage: string;
}

export interface QuizGenerationParams {
  topicTitle: string;
  subjectName: string;
  chunks: RetrievedChunk[];
  numMCQ?: number;
  numShortAnswer?: number;
}

/**
 * Generates grounded diagnostic quiz questions derived directly from retrieved source passages.
 * Each question must cite the specific document title, page number, and quote the exact supporting passage.
 */
export async function generateDiagnosticQuestions({
  topicTitle,
  subjectName,
  chunks,
  numMCQ = 3,
  numShortAnswer = 2,
}: QuizGenerationParams): Promise<GeneratedQuestionPayload[]> {
  if (!chunks || chunks.length === 0) {
    throw new Error('Insufficient retrieved study material to generate grounded quiz questions. Please upload relevant notes or textbook chapters for this topic.');
  }

  // Format passages as evidence catalog
  const formattedPassages = chunks.map((chunk, idx) => {
    return `[PASSAGE ${idx + 1}]
Source Document: "${chunk.document_title}"
Page Number: ${chunk.page_number || 'N/A'}
Section: ${chunk.section_title || 'General'}
Content:
${chunk.content}
----------------------------------------`;
  }).join('\n\n');

  const systemInstruction = `You are an expert academic examiner and diagnostic test architect.
Generate high-quality diagnostic quiz questions that strictly test student understanding of "${topicTitle}" in "${subjectName}".
MANDATORY CONSTRAINTS:
1. Every single question MUST be directly answerable from the provided PASSAGES.
2. Under NO circumstance should you fabricate facts or rely on external knowledge not present in the passages.
3. For multiple-choice questions, provide exactly 4 distinct options (A, B, C, D) and specify the exact correct answer.
4. For short-answer questions, provide an explicit expected answer and key scoring criteria in the explanation.
5. Provide the exact citation: document title, page number, and direct verbatim quotation from the cited passage.
6. Return questions at varied difficulty levels (easy, medium, hard).`;

  const prompt = `Based strictly on the following study material passages, generate ${numMCQ} multiple-choice questions and ${numShortAnswer} short-answer questions for the topic "${topicTitle}".

OUTPUT JSON FORMAT:
{
  "questions": [
    {
      "question_text": "Clear, rigorous question stem",
      "question_type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option B",
      "explanation": "Clear explanation citing the rationale and source evidence",
      "difficulty": "medium",
      "citation_document_title": "Source Document Title",
      "citation_page": 12,
      "citation_passage": "Exact verbatim excerpt from the passage supporting the question and answer"
    },
    {
      "question_text": "Analytical conceptual short-answer question",
      "question_type": "short_answer",
      "options": null,
      "correct_answer": "Complete expected student answer highlighting key mechanisms/principles",
      "explanation": "Scoring rubric criteria: Key points required for full marks",
      "difficulty": "hard",
      "citation_document_title": "Source Document Title",
      "citation_page": 14,
      "citation_passage": "Exact verbatim excerpt from the passage"
    }
  ]
}

STUDY MATERIAL PASSAGES:
${formattedPassages}`;

  try {
    const result = await generateStructuredJSON<{ questions: GeneratedQuestionPayload[] }>({
      prompt,
      systemInstruction,
      temperature: 0.2,
    });

    if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
      throw new Error('Failed to generate valid quiz questions from the provided passages.');
    }

    // Validate that questions have non-empty text, citations, and answers
    const validQuestions = result.questions.filter((q) => {
      const hasText = Boolean(q.question_text && q.question_text.trim());
      const hasAnswer = Boolean(q.correct_answer && q.correct_answer.trim());
      const hasCitation = Boolean(q.citation_document_title);
      if (q.question_type === 'multiple_choice') {
        return hasText && hasAnswer && hasCitation && Array.isArray(q.options) && q.options.length >= 2;
      }
      return hasText && hasAnswer && hasCitation;
    });

    if (validQuestions.length === 0) {
      throw new Error('Questions generated from source material did not meet validation standards.');
    }

    return validQuestions;
  } catch (error: any) {
    console.error('Quiz generation error:', error);
    throw new Error(`Quiz generation failed: ${error.message}`);
  }
}
