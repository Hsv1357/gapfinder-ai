import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';
import { generateDiagnosticQuestions } from '@/lib/quiz/generator';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId, topicId, subjectId, numMCQ = 3, numShortAnswer = 2 } = await req.json();

    if (!documentId && !subjectId && !topicId) {
      return NextResponse.json({ error: 'Please select a document, topic, or subject to generate a quiz.' }, { status: 400 });
    }

    let resolvedSubjectId = subjectId;
    let topicTitle = 'Core Curriculum Review';
    let subjectName = 'General Course';
    let chunks: any[] = [];

    // Case 1: Diagnose directly by uploaded Document
    if (documentId) {
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*, subjects(id, name)')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (docError || !doc) {
        return NextResponse.json({ error: 'Selected document not found.' }, { status: 404 });
      }

      if (doc.processing_status !== 'ready') {
        return NextResponse.json({
          error: `Document "${doc.title}" is currently "${doc.processing_status}". Only ready documents can be used for diagnostic quizzes.`,
        }, { status: 400 });
      }

      topicTitle = doc.title;
      subjectName = doc.subjects?.name || doc.title;
      resolvedSubjectId = doc.subject_id;

      // Ensure a valid subject exists for relational integrity with quizzes.subject_id
      if (!resolvedSubjectId) {
        const { data: existingSub } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('user_id', user.id)
          .limit(1);

        if (existingSub && existingSub.length > 0) {
          resolvedSubjectId = existingSub[0].id;
        } else {
          const { data: newSub } = await supabase
            .from('subjects')
            .insert({
              user_id: user.id,
              name: doc.title,
            })
            .select()
            .single();
          resolvedSubjectId = newSub?.id;
        }

        if (resolvedSubjectId) {
          await supabase.from('documents').update({ subject_id: resolvedSubjectId }).eq('id', documentId);
        }
      }

      // Fetch chunks belonging directly to this document
      const { data: docChunks, error: docChunksError } = await supabase
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });

      if (docChunksError || !docChunks || docChunks.length === 0) {
        return NextResponse.json({
          error: `Document "${doc.title}" contains no processed vector chunks. Please re-upload or retry extraction.`,
        }, { status: 422 });
      }

      // Select representative chunks across the document (up to 8 chunks)
      const maxChunksToUse = 8;
      let sampledChunks: any[] = [];
      if (docChunks.length <= maxChunksToUse) {
        sampledChunks = docChunks;
      } else {
        const step = docChunks.length / maxChunksToUse;
        for (let i = 0; i < maxChunksToUse; i++) {
          const idx = Math.min(Math.floor(i * step), docChunks.length - 1);
          sampledChunks.push(docChunks[idx]);
        }
      }

      chunks = sampledChunks.map((c: any) => ({
        id: c.id,
        document_id: c.document_id,
        document_title: doc.title,
        page_number: c.page_number,
        section_title: c.section_title,
        content: c.content,
        similarity: 1.0,
      }));
    } else if (topicId) {
      // Case 2: Diagnose by extracted curriculum Topic
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .select('*, subjects(id, name)')
        .eq('id', topicId)
        .eq('user_id', user.id)
        .single();

      if (topicError || !topic) {
        return NextResponse.json({ error: 'Topic not found.' }, { status: 404 });
      }

      topicTitle = topic.title;
      resolvedSubjectId = topic.subject_id;
      subjectName = topic.subjects?.name || subjectName;

      const query = `${topicTitle} key concepts principles definitions examples`;
      chunks = await retrieveRelevantChunks({
        userId: user.id,
        subjectId: resolvedSubjectId,
        query,
        matchCount: 6,
        threshold: 0.4,
        supabaseClient: supabase,
      });
    } else {
      // Case 3: Diagnose by Subject
      const { data: sub } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .eq('user_id', user.id)
        .single();
      if (sub) {
        subjectName = sub.name;
      }

      const query = `${subjectName} core concepts and fundamental topics`;
      chunks = await retrieveRelevantChunks({
        userId: user.id,
        subjectId: resolvedSubjectId,
        query,
        matchCount: 6,
        threshold: 0.4,
        supabaseClient: supabase,
      });
    }

    if (chunks.length === 0) {
      return NextResponse.json({
        error: `Insufficient indexed notes found for "${topicTitle}". Please upload notes or lecture materials covering this topic first.`,
      }, { status: 422 });
    }

    // 2. Grounded Question Generation
    const generatedQuestions = await generateDiagnosticQuestions({
      topicTitle,
      subjectName,
      chunks,
      numMCQ,
      numShortAnswer,
    });

    // 3. Create Quiz Record in database
    const { data: quizRecord, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        subject_id: resolvedSubjectId,
        topic_id: topicId || null,
        title: `Diagnostic Quiz: ${topicTitle}`,
        quiz_type: 'diagnostic',
        status: 'in_progress',
        total_questions: generatedQuestions.length,
      })
      .select()
      .single();

    if (quizError || !quizRecord) {
      return NextResponse.json({ error: 'Failed to create quiz record in database.' }, { status: 500 });
    }

    // 4. Save Questions (storing correct answer securely on server)
    const questionRows = generatedQuestions.map((q, idx) => ({
      quiz_id: quizRecord.id,
      user_id: user.id,
      topic_id: topicId || null,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      citation_document_title: q.citation_document_title,
      citation_page: q.citation_page,
      citation_passage: q.citation_passage,
      order_index: idx + 1,
    }));

    const { data: insertedQuestions, error: insertQuestionsError } = await supabase
      .from('quiz_questions')
      .insert(questionRows)
      .select();

    if (insertQuestionsError || !insertedQuestions) {
      return NextResponse.json({ error: 'Failed to insert quiz questions.' }, { status: 500 });
    }

    // 5. Hide correct_answer and explanation before sending to client for active quiz
    const sanitizedQuestions = insertedQuestions.map((q: any) => ({
      id: q.id,
      quiz_id: q.quiz_id,
      topic_id: q.topic_id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      difficulty: q.difficulty,
      citation_document_title: q.citation_document_title,
      citation_page: q.citation_page,
      order_index: q.order_index,
    }));

    return NextResponse.json({
      quiz: quizRecord,
      questions: sanitizedQuestions,
    });
  } catch (err: any) {
    console.error('Quiz generation route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
