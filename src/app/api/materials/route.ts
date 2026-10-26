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

    let query = supabase
      .from('documents')
      .select('*, subjects(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data: documents, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name, code')
      .eq('user_id', user.id)
      .order('name');

    return NextResponse.json({ documents: documents || [], subjects: subjects || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    // Fetch document to check for storage path
    const { data: doc } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (doc?.storage_path) {
      try {
        await supabase.storage.from('study-materials').remove([doc.storage_path]);
      } catch (stErr) {
        console.warn('Storage delete warning:', stErr);
      }
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
