import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subject_id');

    // 1. Fetch user subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const activeSubjectId = subjectId || subjects?.[0]?.id || null;

    // 2. Count documents
    let docsQuery = supabase
      .from('documents')
      .select('id, file_type, processing_status', { count: 'exact' })
      .eq('user_id', user.id);

    if (activeSubjectId) {
      docsQuery = docsQuery.eq('subject_id', activeSubjectId);
    }
    const { count: totalDocuments } = await docsQuery;

    // 3. Count topics and mastery breakdown
    let topicsQuery = supabase
      .from('topics')
      .select('id, level', { count: 'exact' })
      .eq('user_id', user.id)
      .in('level', ['topic', 'subtopic']);

    if (activeSubjectId) {
      topicsQuery = topicsQuery.eq('subject_id', activeSubjectId);
    }
    const { count: totalActionableTopics } = await topicsQuery;

    let masteryQuery = supabase
      .from('topic_mastery')
      .select('classification, score_percentage, updated_at')
      .eq('user_id', user.id);

    if (activeSubjectId) {
      masteryQuery = masteryQuery.eq('subject_id', activeSubjectId);
    }
    const { data: masteries } = await masteryQuery;

    let weakCount = 0;
    let mediumCount = 0;
    let strongCount = 0;
    let scoreSum = 0;
    let assessedCount = 0;

    (masteries || []).forEach((m: any) => {
      if (m.classification === 'weak') weakCount++;
      else if (m.classification === 'medium') mediumCount++;
      else if (m.classification === 'strong') strongCount++;

      if (m.classification !== 'not_assessed') {
        scoreSum += Number(m.score_percentage) || 0;
        assessedCount++;
      }
    });

    const notAssessedCount = Math.max(0, (totalActionableTopics || 0) - assessedCount);
    const averageScore = assessedCount > 0 ? Math.round(scoreSum / assessedCount) : 0;

    // 4. Revision Plan & Tasks
    let planQuery = supabase
      .from('revision_plans')
      .select('id, exam_date, daily_study_hours, total_tasks, completed_tasks')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (activeSubjectId) {
      planQuery = planQuery.eq('subject_id', activeSubjectId);
    }
    const { data: plans } = await planQuery;
    const activePlan = plans?.[0] || null;

    let examDate = activePlan?.exam_date || subjects?.[0]?.exam_date || null;
    let daysToExam = null;
    if (examDate) {
      const diff = new Date(examDate).getTime() - new Date().setHours(0, 0, 0, 0);
      daysToExam = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // 5. Recent Quizzes
    let quizQuery = supabase
      .from('quizzes')
      .select('id, title, score_percentage, completed_at, status')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    if (activeSubjectId) {
      quizQuery = quizQuery.eq('subject_id', activeSubjectId);
    }
    const { data: recentQuizzes } = await quizQuery;

    // 6. Topic Mastery History Trend
    let trendQuery = supabase
      .from('topic_mastery_history')
      .select('score_percentage, classification, recorded_at')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true })
      .limit(20);

    const { data: historyTrend } = await trendQuery;

    return NextResponse.json({
      subjects: subjects || [],
      activeSubjectId,
      metrics: {
        totalDocuments: totalDocuments || 0,
        totalTopics: totalActionableTopics || 0,
        assessedTopics: assessedCount,
        averageMastery: averageScore,
        daysToExam,
        examDate,
        gaps: {
          weak: weakCount,
          medium: mediumCount,
          strong: strongCount,
          notAssessed: notAssessedCount,
        },
        revision: {
          hasPlan: Boolean(activePlan),
          totalTasks: activePlan?.total_tasks || 0,
          completedTasks: activePlan?.completed_tasks || 0,
          remainingTasks: Math.max(0, (activePlan?.total_tasks || 0) - (activePlan?.completed_tasks || 0)),
          progressPercentage: activePlan?.total_tasks
            ? Math.round((activePlan.completed_tasks / activePlan.total_tasks) * 100)
            : 0,
        },
      },
      recentQuizzes: recentQuizzes || [],
      masteryTrend: (historyTrend || []).map((h: any, idx: number) => ({
        entry: idx + 1,
        score: h.score_percentage,
        classification: h.classification,
        date: new Date(h.recorded_at).toLocaleDateString(),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
