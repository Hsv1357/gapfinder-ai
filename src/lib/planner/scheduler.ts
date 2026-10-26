import { MasteryClassification, TaskPriority } from '@/types/database';

export interface TopicForPlanning {
  id: string;
  title: string;
  importance: 'high' | 'medium' | 'low';
  classification: MasteryClassification;
  scorePercentage: number;
  sourceDocTitle?: string;
}

export interface PlanningInput {
  subjectName: string;
  examDate: string;        // YYYY-MM-DD
  dailyStudyHours: number; // e.g. 2.5
  topics: TopicForPlanning[];
  existingCompletedTaskTopicIds?: Set<string>;
}

export interface GeneratedRevisionTask {
  topicId: string;
  topicTitle: string;
  priority: TaskPriority;
  scheduledDate: string;
  estimatedDurationMinutes: number;
  suggestedActivity: string;
  sourceMaterialReference: string;
  status: 'pending';
  orderIndex: number;
}

export interface GeneratedPlanResult {
  title: string;
  examDate: string;
  dailyStudyHours: number;
  totalDaysAvailable: number;
  totalEstimatedMinutes: number;
  isScheduleFeasible: boolean;
  feasibilityWarning?: string;
  tasks: GeneratedRevisionTask[];
}

/**
 * Generates an adaptive, prioritized revision timetable.
 * Allocates highest focus to WEAK topics, followed by MEDIUM topics, then periodic refresher blocks for STRONG topics.
 */
export function generateAdaptiveRevisionPlan({
  subjectName,
  examDate,
  dailyStudyHours,
  topics,
  existingCompletedTaskTopicIds = new Set(),
}: PlanningInput): GeneratedPlanResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetExam = new Date(examDate);
  targetExam.setHours(0, 0, 0, 0);

  const diffMs = targetExam.getTime() - today.getTime();
  const totalDaysAvailable = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const dailyMinutesAvailable = Math.max(30, Math.round(dailyStudyHours * 60));
  const totalCapacityMinutes = totalDaysAvailable * dailyMinutesAvailable;

  // Categorize topics
  const weakTopics = topics.filter((t) => t.classification === 'weak' || t.classification === 'not_assessed');
  const mediumTopics = topics.filter((t) => t.classification === 'medium');
  const strongTopics = topics.filter((t) => t.classification === 'strong');

  // Sort inside categories by importance ('high' first)
  const importanceRank = { high: 3, medium: 2, low: 1 };
  const sortByImportance = (a: TopicForPlanning, b: TopicForPlanning) =>
    (importanceRank[b.importance] || 2) - (importanceRank[a.importance] || 2);

  weakTopics.sort(sortByImportance);
  mediumTopics.sort(sortByImportance);
  strongTopics.sort(sortByImportance);

  const taskQueue: {
    topic: TopicForPlanning;
    priority: TaskPriority;
    duration: number;
    activity: string;
  }[] = [];

  // 1. Weak Topics get high priority and intensive 60-minute deep-dives
  for (const topic of weakTopics) {
    if (existingCompletedTaskTopicIds.has(topic.id)) continue;
    taskQueue.push({
      topic,
      priority: 'high',
      duration: 60,
      activity: `Deep-Dive Revision & Core Concept Remediation: Re-read highlighted notes, review textbook worked examples, and create summary flash cards.`,
    });
    // Follow-up diagnostic re-test
    taskQueue.push({
      topic,
      priority: 'high',
      duration: 30,
      activity: `Targeted Diagnostic Re-Evaluation: Retake quiz questions for "${topic.title}" to verify gap closure.`,
    });
  }

  // 2. Medium Topics get medium priority and focused 45-minute practice
  for (const topic of mediumTopics) {
    if (existingCompletedTaskTopicIds.has(topic.id)) continue;
    taskQueue.push({
      topic,
      priority: 'medium',
      duration: 45,
      activity: `Targeted Problem Solving: Work through past paper questions and formulas focusing on nuanced edge cases.`,
    });
  }

  // 3. Strong Topics get periodic 30-minute spaced repetition reviews
  for (const topic of strongTopics) {
    taskQueue.push({
      topic,
      priority: 'low',
      duration: 30,
      activity: `Active Recall & Spaced Retention: 15-minute quick flash review and formula drill.`,
    });
  }

  let totalEstimatedMinutes = 0;
  const scheduledTasks: GeneratedRevisionTask[] = [];

  let currentDayOffset = 0;
  let currentDayUsedMinutes = 0;
  let taskOrder = 1;

  for (const item of taskQueue) {
    // If current day is full, roll over to next day
    if (currentDayUsedMinutes + item.duration > dailyMinutesAvailable) {
      currentDayOffset += 1;
      currentDayUsedMinutes = 0;
    }

    const scheduledDate = new Date(today);
    scheduledDate.setDate(today.getDate() + Math.min(currentDayOffset, totalDaysAvailable - 1));
    const dateString = scheduledDate.toISOString().split('T')[0];

    scheduledTasks.push({
      topicId: item.topic.id,
      topicTitle: item.topic.title,
      priority: item.priority,
      scheduledDate: dateString,
      estimatedDurationMinutes: item.duration,
      suggestedActivity: item.activity,
      sourceMaterialReference: item.topic.sourceDocTitle
        ? `Refer to ${item.topic.sourceDocTitle}`
        : 'Uploaded Study Materials',
      status: 'pending',
      orderIndex: taskOrder++,
    });

    currentDayUsedMinutes += item.duration;
    totalEstimatedMinutes += item.duration;
  }

  const isScheduleFeasible = totalEstimatedMinutes <= totalCapacityMinutes;
  let feasibilityWarning: string | undefined;

  if (!isScheduleFeasible) {
    const hoursNeeded = (totalEstimatedMinutes / 60).toFixed(1);
    const hoursAvailable = (totalCapacityMinutes / 60).toFixed(1);
    feasibilityWarning = `Schedule warning: You have ${hoursNeeded} hours of recommended gap remediation before ${examDate}, but only ${hoursAvailable} hours available at ${dailyStudyHours} hrs/day. Consider increasing your daily revision window to ${(totalEstimatedMinutes / totalDaysAvailable / 60).toFixed(1)} hrs/day.`;
  }

  return {
    title: `${subjectName} Adaptive Revision Plan`,
    examDate,
    dailyStudyHours,
    totalDaysAvailable,
    totalEstimatedMinutes,
    isScheduleFeasible,
    feasibilityWarning,
    tasks: scheduledTasks,
  };
}
