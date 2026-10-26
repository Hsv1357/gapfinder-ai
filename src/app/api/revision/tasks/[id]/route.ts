import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await req.json();
    if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    const { data: updatedTask, error: updateError } = await supabase
      .from('revision_tasks')
      .update({
        status,
        completed_at: completedAt,
      })
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !updatedTask) {
      return NextResponse.json({ error: 'Task not found or update failed.' }, { status: 404 });
    }

    // Recalculate completed tasks count on the plan
    const { data: countData } = await supabase
      .from('revision_tasks')
      .select('id', { count: 'exact' })
      .eq('plan_id', updatedTask.plan_id)
      .eq('status', 'completed');

    const completedCount = countData ? countData.length : 0;

    await supabase
      .from('revision_plans')
      .update({
        completed_tasks: completedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', updatedTask.plan_id);

    return NextResponse.json({
      success: true,
      task: updatedTask,
      completedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
