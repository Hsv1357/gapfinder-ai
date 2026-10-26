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

    let planQuery = supabase
      .from('revision_plans')
      .select('*, subjects(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (subjectId) {
      planQuery = planQuery.eq('subject_id', subjectId);
    }

    const { data: plans, error: planError } = await planQuery;
    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    const plan = plans?.[0];
    if (!plan) {
      return NextResponse.json({ plan: null, tasks: [] });
    }

    const { data: tasks, error: taskError } = await supabase
      .from('revision_tasks')
      .select('*, topics(id, title)')
      .eq('plan_id', plan.id)
      .order('scheduled_date', { ascending: true })
      .order('order_index', { ascending: true });

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    return NextResponse.json({
      plan,
      tasks: (tasks || []).map((t: any) => ({
        ...t,
        topic_title: t.topics?.title || 'Course Topic',
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
