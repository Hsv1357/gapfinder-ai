import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { extractTopicsFromSyllabus } from '@/lib/topics/extractor';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId, subjectId: existingSubjectId } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter.' }, { status: 400 });
    }

    // 1. Fetch document and chunks
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'Document contains no processed chunks to extract topics from.' }, { status: 400 });
    }

    const fullSyllabusText = chunks.map((c: any) => c.content).join('\n\n');

    // 2. Call extraction engine
    const extracted = await extractTopicsFromSyllabus(fullSyllabusText);

    // 3. Resolve or create subject
    let subjectId = existingSubjectId;
    if (!subjectId) {
      const { data: newSubject, error: subError } = await supabase
        .from('subjects')
        .insert({
          user_id: user.id,
          name: extracted.subjectName || doc.title,
          code: extracted.subjectCode || null,
          description: extracted.summary || null,
        })
        .select()
        .single();

      if (subError) {
        console.error('Failed to create subject:', subError);
        return NextResponse.json({ error: 'Could not create subject record.' }, { status: 500 });
      }
      subjectId = newSubject.id;

      // Link document to subject
      await supabase
        .from('documents')
        .update({ subject_id: subjectId })
        .eq('id', documentId);
    }

    // 4. Save units, topics, and subtopics into `topics` table
    let orderCounter = 1;
    const insertedTopics: any[] = [];

    for (const unit of extracted.units) {
      const { data: unitRecord, error: unitError } = await supabase
        .from('topics')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          title: unit.title,
          level: 'unit',
          order_index: orderCounter++,
          description: unit.description || null,
          estimated_importance: unit.estimatedImportance || 'medium',
        })
        .select()
        .single();

      if (unitError || !unitRecord) continue;
      insertedTopics.push(unitRecord);

      // Subtopics under unit
      if (unit.subtopics && Array.isArray(unit.subtopics)) {
        for (const topic of unit.subtopics) {
          const { data: topicRecord, error: topicError } = await supabase
            .from('topics')
            .insert({
              user_id: user.id,
              subject_id: subjectId,
              parent_id: unitRecord.id,
              title: topic.title,
              level: 'topic',
              order_index: orderCounter++,
              description: topic.description || null,
              estimated_importance: topic.estimatedImportance || 'medium',
            })
            .select()
            .single();

          if (topicError || !topicRecord) continue;
          insertedTopics.push(topicRecord);

          // Associate topic with document source
          await supabase.from('topic_sources').insert({
            user_id: user.id,
            topic_id: topicRecord.id,
            document_id: documentId,
            relevance_note: `Extracted from syllabus unit "${unit.title}"`,
          });

          // Level 3 subtopics if present
          if (topic.subtopics && Array.isArray(topic.subtopics)) {
            for (const sub of topic.subtopics) {
              await supabase.from('topics').insert({
                user_id: user.id,
                subject_id: subjectId,
                parent_id: topicRecord.id,
                title: sub.title,
                level: 'subtopic',
                order_index: orderCounter++,
                description: sub.description || null,
                estimated_importance: sub.estimatedImportance || 'medium',
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      subjectId,
      subjectName: extracted.subjectName,
      totalTopicsExtracted: insertedTopics.length,
      topics: insertedTopics,
    });
  } catch (err: any) {
    console.error('Topic extraction error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
