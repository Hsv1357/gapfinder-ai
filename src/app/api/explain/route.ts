import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';
import { explainTopicWithGrounding } from '@/lib/assistant/explainer';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, subjectId, topicId } = await req.json();

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Please enter a topic or question to explain.' }, { status: 400 });
    }

    let subjectName: string | undefined;
    if (subjectId) {
      const { data: sub } = await supabase
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .eq('user_id', user.id)
        .single();
      if (sub) subjectName = sub.name;
    }

    // 1. Vector Retrieval of authorized passages
    const retrievedChunks = await retrieveRelevantChunks({
      userId: user.id,
      subjectId: subjectId || undefined,
      query: query.trim(),
      matchCount: 5,
      threshold: 0.35,
      supabaseClient: supabase,
    });

    // 2. Grounded Explanation Generation
    const result = await explainTopicWithGrounding({
      topicOrQuery: query.trim(),
      subjectName,
      retrievedChunks,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Explain route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
