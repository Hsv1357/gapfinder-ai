import { generateStructuredJSON } from '../gemini';
import { RubricFeedback, QuestionType } from '@/types/database';

export interface EvaluationInput {
  questionType: QuestionType;
  questionText: string;
  expectedAnswer: string;
  studentAnswer: string;
  sourcePassage?: string | null;
  explanation?: string;
}

export interface EvaluationResult {
  isCorrect: boolean;
  score: number;       // 0 to 1.0
  maxScore: number;    // 1.0
  rubricFeedback: RubricFeedback;
}

/**
 * Deterministic evaluation for multiple choice answers.
 */
export function evaluateMultipleChoice(
  studentAnswer: string,
  correctAnswer: string
): EvaluationResult {
  const cleanStudent = studentAnswer.trim().toLowerCase();
  const cleanCorrect = correctAnswer.trim().toLowerCase();

  // Check exact string or option letter match (e.g. "A" vs "A) Paris" or "Paris")
  const isCorrect =
    cleanStudent === cleanCorrect ||
    cleanStudent.startsWith(cleanCorrect + ')') ||
    cleanStudent.startsWith(cleanCorrect + '. ') ||
    cleanCorrect.startsWith(cleanStudent + ')') ||
    cleanCorrect.startsWith(cleanStudent + '. ');

  const score = isCorrect ? 1.0 : 0.0;

  return {
    isCorrect,
    score,
    maxScore: 1.0,
    rubricFeedback: {
      score,
      max_score: 1.0,
      is_correct: isCorrect,
      key_points_identified: isCorrect ? ['Selected the mathematically/conceptually correct option'] : [],
      missed_points: isCorrect ? [] : [`Selected "${studentAnswer}", expected "${correctAnswer}"`],
      reasoning: isCorrect
        ? 'Your selection matches the validated source answer.'
        : `Incorrect selection. The verified correct answer is "${correctAnswer}".`,
      suggested_improvement: isCorrect
        ? 'Great mastery! Proceed to more challenging synthesis questions.'
        : 'Review the cited reference passage to reinforce the key distinction.',
    },
  };
}

/**
 * Rubric-based evaluation for short-answer questions.
 * Compares student answer against expected answer and cited source passage.
 */
export async function evaluateShortAnswer({
  questionText,
  expectedAnswer,
  studentAnswer,
  sourcePassage,
  explanation,
}: Omit<EvaluationInput, 'questionType'>): Promise<EvaluationResult> {
  const cleanStudent = studentAnswer.trim();

  // Edge case: Empty or trivial answer
  if (!cleanStudent || cleanStudent.length < 2) {
    return {
      isCorrect: false,
      score: 0,
      maxScore: 1.0,
      rubricFeedback: {
        score: 0,
        max_score: 1.0,
        is_correct: false,
        key_points_identified: [],
        missed_points: ['No response provided'],
        reasoning: 'The answer was left blank or empty.',
        suggested_improvement: 'Attempt explaining the fundamental concept using keywords from your textbook.',
      },
    };
  }

  const systemInstruction = `You are a strict academic evaluator.
Evaluate the student's short answer against the verified expected answer and source material evidence.
Score between 0.0 and 1.0 based on conceptual accuracy, key terms, and completeness:
- 1.0: Complete and accurate coverage of key concepts.
- 0.7 - 0.8: Partially complete with the core concept understood, but minor details or terms omitted.
- 0.3 - 0.5: Incomplete; shows slight grasp but has notable misconceptions or omissions.
- 0.0: Wholly incorrect, irrelevant, or contradictory to the facts.`;

  const prompt = `QUESTION:
${questionText}

EXPECTED ANSWER:
${expectedAnswer}

EXPLANATION / KEY CRITERIA:
${explanation || 'Full accuracy on core conceptual principles.'}

VERIFIED SOURCE EVIDENCE:
${sourcePassage || 'N/A'}

STUDENT SUBMITTED ANSWER:
${cleanStudent}

OUTPUT JSON FORMAT:
{
  "score": 0.8,
  "is_correct": true,
  "key_points_identified": ["Point A covered", "Key term mentioned"],
  "missed_points": ["Omitted the boundary conditions"],
  "reasoning": "Clear explanation of why this score was awarded",
  "suggested_improvement": "Actionable advice on what to review in the notes"
}`;

  try {
    const feedback = await generateStructuredJSON<RubricFeedback>({
      prompt,
      systemInstruction,
      temperature: 0.1,
    });

    const normalizedScore = Math.max(0, Math.min(1.0, Number(feedback.score) || 0));
    const isCorrect = normalizedScore >= 0.7;

    return {
      isCorrect,
      score: normalizedScore,
      maxScore: 1.0,
      rubricFeedback: {
        ...feedback,
        score: normalizedScore,
        max_score: 1.0,
        is_correct: isCorrect,
      },
    };
  } catch (error: any) {
    console.error('Short answer evaluation error:', error);
    // Fallback heuristic grading if LLM fails
    const containsKeyword = expectedAnswer
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .some((w) => cleanStudent.toLowerCase().includes(w));

    const fallbackScore = containsKeyword ? 0.5 : 0.0;
    return {
      isCorrect: fallbackScore >= 0.7,
      score: fallbackScore,
      maxScore: 1.0,
      rubricFeedback: {
        score: fallbackScore,
        max_score: 1.0,
        is_correct: fallbackScore >= 0.7,
        key_points_identified: containsKeyword ? ['Recognized core vocabulary term'] : [],
        missed_points: containsKeyword ? ['Needs more detailed elaboration'] : ['Missing essential concepts'],
        reasoning: containsKeyword
          ? 'Answer contains relevant terminology but requires comprehensive explanation.'
          : 'Answer does not align with the expected explanation.',
        suggested_improvement: 'Review the chapter summary and definition sections.',
      },
    };
  }
}

/**
 * Universal evaluator dispatcher.
 */
export async function evaluateAnswer(input: EvaluationInput): Promise<EvaluationResult> {
  if (input.questionType === 'multiple_choice') {
    return evaluateMultipleChoice(input.studentAnswer, input.expectedAnswer);
  }
  return evaluateShortAnswer(input);
}
