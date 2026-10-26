import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { TopicMastery } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subject_id');

    // 1. Fetch all topics for the user / subject
    let topicQuery = supabase
      .from('topics')
      .select('id, title, level, estimated_importance, subject_id, subjects(name)')
      .eq('user_id', user.id);

    if (subjectId) {
      topicQuery = topicQuery.eq('subject_id', subjectId);
    }

    const { data: topics, error: tError } = await topicQuery;
    if (tError) {
      return NextResponse.json({ error: tError.message }, { status: 500 });
    }

    // Filter to actionable topics (level = topic or subtopic)
    const actionableTopics = (topics || []).filter((t: any) => t.level === 'topic' || t.level === 'subtopic');

    // 2. Fetch all mastery records for this user
    let masteryQuery = supabase
      .from('topic_mastery')
      .select('*')
      .eq('user_id', user.id);

    if (subjectId) {
      masteryQuery = masteryQuery.eq('subject_id', subjectId);
    }

    const { data: masteries, error: mError } = await masteryQuery;
    if (mError) {
      return NextResponse.json({ error: mError.message }, { status: 500 });
    }

    const masteryMap = new Map<string, any>((masteries || []).map((m: any) => [m.topic_id, m]));

    const weak: any[] = [];
    const medium: any[] = [];
    const strong: any[] = [];
    const notAssessed: any[] = [];

    let totalScoreSum = 0;
    let assessedCount = 0;

    actionableTopics.forEach((t: any) => {
      const m = masteryMap.get(t.id);
      const subjectName = t.subjects?.name || 'General Course';

      if (!m || m.classification === 'not_assessed' || m.total_questions_answered === 0) {
        notAssessed.push({
          topic_id: t.id,
          topic_title: t.title,
          subject_id: t.subject_id,
          subject_name: subjectName,
          score_percentage: 0,
          classification: 'not_assessed',
          total_questions_answered: 0,
          correct_answers: 0,
          classification_reason: 'No diagnostic quiz attempts completed yet.',
          suggested_next_action: 'Take a diagnostic quiz on this topic to evaluate your starting knowledge.',
          estimated_importance: t.estimated_importance,
        });
      } else {
        const item: any = {
          ...m,
          topic_title: t.title,
          subject_name: subjectName,
        };

        totalScoreSum += Number(m.score_percentage) || 0;
        assessedCount += 1;

        if (m.classification === 'weak') {
          weak.push(item);
        } else if (m.classification === 'medium') {
          medium.push(item);
        } else {
          strong.push(item);
        }
      }
    });

    const overallReadiness = assessedCount > 0
      ? Math.round(totalScoreSum / assessedCount)
      : 0;

    return NextResponse.json({
      overallReadiness,
      totalActionableTopics: actionableTopics.length,
      assessedTopicsCount: assessedCount,
      summary: {
        weakCount: weak.length,
        mediumCount: medium.length,
        strongCount: strong.length,
        notAssessedCount: notAssessed.length,
      },
      categories: {
        weak,
        medium,
        strong,
        notAssessed,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
