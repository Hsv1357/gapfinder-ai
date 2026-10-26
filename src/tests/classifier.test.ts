import { describe, it, expect } from 'vitest';
import { classifyTopicMastery, AssessmentAttempt } from '../lib/gap-analysis/classifier';

describe('Knowledge Gap Classifier', () => {
  it('classifies empty attempts as not_assessed', () => {
    const result = classifyTopicMastery('Binary Trees', []);
    expect(result.classification).toBe('not_assessed');
    expect(result.totalQuestions).toBe(0);
    expect(result.scorePercentage).toBe(0);
    expect(result.suggestedNextAction).toContain('Take an initial');
  });

  it('classifies scores below 50% as weak knowledge gap', () => {
    const attempts: AssessmentAttempt[] = [
      { quizId: 'q1', score: 0, maxScore: 1, difficulty: 'medium', date: '2026-10-20' },
      { quizId: 'q1', score: 0, maxScore: 1, difficulty: 'easy', date: '2026-10-20' },
      { quizId: 'q2', score: 1, maxScore: 1, difficulty: 'hard', date: '2026-10-21' },
    ];
    const result = classifyTopicMastery('Dynamic Programming', attempts);
    expect(result.classification).toBe('weak');
    expect(result.scorePercentage).toBeLessThan(50);
    expect(result.reason).toContain('gap identified');
  });

  it('classifies scores between 50% and 79% as medium', () => {
    const attempts: AssessmentAttempt[] = [
      { quizId: 'q1', score: 1, maxScore: 1, difficulty: 'medium', date: '2026-10-20' },
      { quizId: 'q1', score: 0.5, maxScore: 1, difficulty: 'medium', date: '2026-10-20' },
      { quizId: 'q2', score: 1, maxScore: 1, difficulty: 'medium', date: '2026-10-21' },
      { quizId: 'q2', score: 0, maxScore: 1, difficulty: 'medium', date: '2026-10-21' },
    ];
    const result = classifyTopicMastery('Sorting Algorithms', attempts);
    expect(result.classification).toBe('medium');
    expect(result.scorePercentage).toBeGreaterThanOrEqual(50);
    expect(result.scorePercentage).toBeLessThan(80);
  });

  it('classifies scores >= 80% as strong mastery', () => {
    const attempts: AssessmentAttempt[] = [
      { quizId: 'q1', score: 1, maxScore: 1, difficulty: 'easy', date: '2026-10-20' },
      { quizId: 'q1', score: 1, maxScore: 1, difficulty: 'medium', date: '2026-10-20' },
      { quizId: 'q2', score: 1, maxScore: 1, difficulty: 'hard', date: '2026-10-21' },
    ];
    const result = classifyTopicMastery('Recursion Basics', attempts);
    expect(result.classification).toBe('strong');
    expect(result.scorePercentage).toBeGreaterThanOrEqual(80);
  });
});
