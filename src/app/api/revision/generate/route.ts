import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { generateAdaptiveRevisionPlan, TopicForPlanning } from '@/lib/planner/scheduler';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subjectId, examDate, dailyStudyHours = 3.0 } = await req.json();

    if (!subjectId || !examDate) {
      return NextResponse.json({ error: 'subjectId and examDate are required.' }, { status: 400 });
    }

    // 1. Fetch Subject
    const { data: subject, error: subError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .eq('user_id', user.id)
      .single();

    if (subError || !subject) {
      return NextResponse.json({ error: 'Subject not found.' }, { status: 404 });
    }

    // 2. Fetch Topics and Mastery
    const { data: topics, error: tError } = await supabase
      .from('topics')
      .select('id, title, estimated_importance, level, topic_mastery(*), topic_sources(documents(title))')
      .eq('subject_id', subjectId)
      .eq('user_id', user.id);

    if (tError || !topics || topics.length === 0) {
      return NextResponse.json({ error: 'No topics found for this subject. Please extract topics from syllabus first.' }, { status: 400 });
    }

    // 3. Find any already completed task topic IDs to preserve progress
    const { data: completedTasks } = await supabase
      .from('revision_tasks')
      .select('topic_id')
      .eq('user_id', user.id)
      .eq('status', 'completed');

    const completedTopicIds = new Set<string>(
      (completedTasks || []).map((t: any) => t.topic_id).filter(Boolean)
    );

    // 4. Map topics to TopicForPlanning
    const planningTopics: TopicForPlanning[] = topics
      .filter((t: any) => t.level === 'topic' || t.level === 'subtopic')
      .map((t: any) => {
        const m = t.topic_mastery?.[0];
        const docTitle = t.topic_sources?.[0]?.documents?.title;
        return {
          id: t.id,
          title: t.title,
          importance: t.estimated_importance || 'medium',
          classification: m?.classification || 'not_assessed',
          scorePercentage: m?.score_percentage || 0,
          sourceDocTitle: docTitle,
        };
      });

    // 5. Run Planner
    const planResult = generateAdaptiveRevisionPlan({
      subjectName: subject.name,
      examDate,
      dailyStudyHours: Number(dailyStudyHours) || 3.0,
      topics: planningTopics,
      existingCompletedTaskTopicIds: completedTopicIds,
    });

    // 6. Archive prior active plans for this subject
    await supabase
      .from('revision_plans')
      .update({ status: 'archived' })
      .eq('subject_id', subjectId)
      .eq('user_id', user.id)
      .eq('status', 'active');

    // 7. Insert new Revision Plan
    const { data: newPlan, error: planInsertError } = await supabase
      .from('revision_plans')
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        title: planResult.title,
        exam_date: examDate,
        daily_study_hours: dailyStudyHours,
        total_tasks: planResult.tasks.length,
        completed_tasks: 0,
        status: 'active',
      })
      .select()
      .single();

    if (planInsertError || !newPlan) {
      return NextResponse.json({ error: 'Failed to create revision plan record.' }, { status: 500 });
    }

    // 8. Insert Tasks
    const taskRows = planResult.tasks.map((t) => ({
      plan_id: newPlan.id,
      user_id: user.id,
      topic_id: t.topicId,
      priority: t.priority,
      scheduled_date: t.scheduledDate,
      estimated_duration_minutes: t.estimatedDurationMinutes,
      suggested_activity: t.suggestedActivity,
      source_material_reference: t.sourceMaterialReference,
      status: 'pending',
      order_index: t.orderIndex,
    }));

    const { data: insertedTasks, error: taskInsertError } = await supabase
      .from('revision_tasks')
      .insert(taskRows)
      .select('*, topics(title)');

    if (taskInsertError) {
      console.error('Task insert error:', taskInsertError);
    }

    return NextResponse.json({
      success: true,
      plan: newPlan,
      tasks: insertedTasks || [],
      feasibilityWarning: planResult.feasibilityWarning,
      totalDaysAvailable: planResult.totalDaysAvailable,
      totalEstimatedMinutes: planResult.totalEstimatedMinutes,
    });
  } catch (err: any) {
    console.error('Revision plan generation error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
