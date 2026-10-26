import { describe, it, expect } from 'vitest';
import { generateAdaptiveRevisionPlan, TopicForPlanning } from '../lib/planner/scheduler';

describe('Adaptive Revision Scheduler', () => {
  const sampleTopics: TopicForPlanning[] = [
    {
      id: 'top-1',
      title: 'Relational Algebra',
      importance: 'high',
      classification: 'weak',
      scorePercentage: 30,
      sourceDocTitle: 'DBMS Chapter 2',
    },
    {
      id: 'top-2',
      title: 'SQL Subqueries',
      importance: 'medium',
      classification: 'medium',
      scorePercentage: 65,
      sourceDocTitle: 'DBMS Chapter 4',
    },
    {
      id: 'top-3',
      title: 'Entity Relationship Diagrams',
      importance: 'low',
      classification: 'strong',
      scorePercentage: 90,
      sourceDocTitle: 'DBMS Chapter 1',
    },
  ];

  it('prioritizes weak topics with higher duration and diagnostic retests', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const examDateStr = futureDate.toISOString().split('T')[0];

    const plan = generateAdaptiveRevisionPlan({
      subjectName: 'Database Management Systems',
      examDate: examDateStr,
      dailyStudyHours: 2.0,
      topics: sampleTopics,
    });

    expect(plan.tasks.length).toBeGreaterThan(0);
    // First tasks must address the high-importance weak topic
    expect(plan.tasks[0].topicId).toBe('top-1');
    expect(plan.tasks[0].priority).toBe('high');
    expect(plan.tasks[0].estimatedDurationMinutes).toBe(60);
  });

  it('detects when allocated study hours are insufficient for exam deadline', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const examDateStr = tomorrow.toISOString().split('T')[0];

    const plan = generateAdaptiveRevisionPlan({
      subjectName: 'Operating Systems',
      examDate: examDateStr,
      dailyStudyHours: 0.5, // 30 minutes capacity for 3 topics requiring ~165 mins
      topics: sampleTopics,
    });

    expect(plan.isScheduleFeasible).toBe(false);
    expect(plan.feasibilityWarning).toBeDefined();
    expect(plan.feasibilityWarning).toContain('Schedule warning');
  });
});
