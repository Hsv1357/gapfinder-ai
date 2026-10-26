import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(_req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*, documents(count)')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subjects: subjects || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, code, description, exam_date } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Subject name is required.' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if subject already exists for this user
    const { data: existing } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('user_id', user.id)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: `A subject with the name "${trimmedName}" already exists.`,
        subject: existing,
      }, { status: 409 });
    }

    const { data: newSubject, error: insertError } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        name: trimmedName,
        code: code?.trim() || null,
        description: description?.trim() || null,
        exam_date: exam_date || null,
      })
      .select()
      .single();

    if (insertError || !newSubject) {
      console.error('Failed to create subject:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Failed to create subject' }, { status: 500 });
    }

    return NextResponse.json({ success: true, subject: newSubject }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing subject id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
