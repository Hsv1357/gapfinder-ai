import { MasteryClassification } from '@/types/database';

export interface AssessmentAttempt {
  quizId: string;
  score: number;       // total points earned
  maxScore: number;    // total points possible
  difficulty?: 'easy' | 'medium' | 'hard';
  date: string;
}

export interface TopicGapClassificationResult {
  scorePercentage: number;
  classification: MasteryClassification;
  confidence: 'preliminary' | 'moderate' | 'high';
  totalQuestions: number;
  correctAnswers: number;
  reason: string;
  suggestedNextAction: string;
}

/**
 * Explicit, reproducible algorithm for classifying student topic mastery into Weak, Medium, Strong, or Not Assessed.
 */
export function classifyTopicMastery(
  topicTitle: string,
  attempts: AssessmentAttempt[]
): TopicGapClassificationResult {
  if (!attempts || attempts.length === 0) {
    return {
      scorePercentage: 0,
      classification: 'not_assessed',
      confidence: 'preliminary',
      totalQuestions: 0,
      correctAnswers: 0,
      reason: `No diagnostic quiz attempts have been recorded for "${topicTitle}".`,
      suggestedNextAction: 'Take an initial 5-question diagnostic quiz to baseline your knowledge.',
    };
  }

  let weightedPointsEarned = 0;
  let weightedPointsPossible = 0;
  let totalQuestions = 0;
  let correctCount = 0;

  for (const attempt of attempts) {
    // Difficulty weighting: Hard questions have higher weight for mastery verification
    const weight = attempt.difficulty === 'hard' ? 1.3 : attempt.difficulty === 'easy' ? 0.8 : 1.0;
    
    weightedPointsEarned += attempt.score * weight;
    weightedPointsPossible += attempt.maxScore * weight;
    totalQuestions += 1;
    if (attempt.score / attempt.maxScore >= 0.7) {
      correctCount += 1;
    }
  }

  const rawPercentage = weightedPointsPossible > 0
    ? (weightedPointsEarned / weightedPointsPossible) * 100
    : 0;

  const scorePercentage = Math.round(Math.min(100, Math.max(0, rawPercentage)));

  // Confidence determination based on question volume
  let confidence: 'preliminary' | 'moderate' | 'high' = 'preliminary';
  if (totalQuestions >= 6) {
    confidence = 'high';
  } else if (totalQuestions >= 3) {
    confidence = 'moderate';
  }

  let classification: MasteryClassification = 'weak';
  let reason = '';
  let suggestedNextAction = '';

  if (scorePercentage >= 80) {
    classification = 'strong';
    reason = confidence === 'preliminary'
      ? `Preliminary Strong (${scorePercentage}%) based on ${totalQuestions} question(s). Early signs of solid comprehension.`
      : `Confirmed Strong mastery (${scorePercentage}%) with ${correctCount}/${totalQuestions} correct responses across varied difficulties.`;
    suggestedNextAction = 'Maintain retention with periodic flash reviews; allocate remaining study blocks to weaker modules.';
  } else if (scorePercentage >= 50) {
    classification = 'medium';
    reason = `Moderate mastery (${scorePercentage}%). Foundational ideas are in place, but gaps exist on edge cases or multi-step questions (${correctCount}/${totalQuestions} correct).`;
    suggestedNextAction = 'Target review on cited textbook sections and practice short-answer synthesis questions.';
  } else {
    classification = 'weak';
    reason = `Significant knowledge gap identified (${scorePercentage}%). Scored below passing threshold across ${totalQuestions} question(s).`;
    suggestedNextAction = 'Priority Revision: Review fundamental definitions and core worked examples before re-attempting diagnostic testing.';
  }

  return {
    scorePercentage,
    classification,
    confidence,
    totalQuestions,
    correctAnswers: correctCount,
    reason,
    suggestedNextAction,
  };
}
