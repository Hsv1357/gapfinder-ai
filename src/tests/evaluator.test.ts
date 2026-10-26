import { describe, it, expect } from 'vitest';
import { evaluateMultipleChoice } from '../lib/quiz/evaluator';

describe('Multiple Choice Evaluator', () => {
  it('correctly matches exact answer strings', () => {
    const res = evaluateMultipleChoice('Option B: Deadlock Prevention', 'Option B: Deadlock Prevention');
    expect(res.isCorrect).toBe(true);
    expect(res.score).toBe(1.0);
  });

  it('correctly matches letter prefix variations', () => {
    const res1 = evaluateMultipleChoice('A', 'A) Semaphores');
    expect(res1.isCorrect).toBe(true);
    expect(res1.score).toBe(1.0);

    const res2 = evaluateMultipleChoice('B) Mutex', 'B');
    expect(res2.isCorrect).toBe(true);
    expect(res2.score).toBe(1.0);
  });

  it('rejects incorrect choices with clear feedback', () => {
    const res = evaluateMultipleChoice('C) Paging', 'A) Segmentation');
    expect(res.isCorrect).toBe(false);
    expect(res.score).toBe(0);
    expect(res.rubricFeedback.missed_points.length).toBeGreaterThan(0);
  });
});
