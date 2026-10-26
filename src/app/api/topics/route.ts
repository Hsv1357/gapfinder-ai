import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { Topic } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subject_id');

    let query = supabase
      .from('topics')
      .select('*, topic_mastery(*)')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true });

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data: rawTopics, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build hierarchical tree
    const topicMap = new Map<string, Topic>();
    const rootUnits: Topic[] = [];

    rawTopics.forEach((t: any) => {
      const topicObj: Topic = {
        ...t,
        mastery: t.topic_mastery?.[0] || null,
        children: [],
      };
      topicMap.set(t.id, topicObj);
    });

    topicMap.forEach((topic) => {
      if (topic.parent_id && topicMap.has(topic.parent_id)) {
        topicMap.get(topic.parent_id)!.children!.push(topic);
      } else if (!topic.parent_id || topic.level === 'unit') {
        rootUnits.push(topic);
      }
    });

    return NextResponse.json({
      topics: rootUnits,
      flatList: Array.from(topicMap.values()),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
