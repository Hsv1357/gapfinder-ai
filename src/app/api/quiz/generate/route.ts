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

    const { topicId, subjectId, numMCQ = 3, numShortAnswer = 2 } = await req.json();

    if (!subjectId && !topicId) {
      return NextResponse.json({ error: 'Please provide either subjectId or topicId.' }, { status: 400 });
    }

    let resolvedSubjectId = subjectId;
    let topicTitle = 'Core Curriculum Review';
    let subjectName = 'General Course';

    if (topicId) {
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
    } else {
      const { data: sub } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .eq('user_id', user.id)
        .single();
      if (sub) {
        subjectName = sub.name;
      }
    }

    // 1. Vector Retrieval of source passages
    const query = `${topicTitle} key concepts principles definitions examples`;
    const chunks = await retrieveRelevantChunks({
      userId: user.id,
      subjectId: resolvedSubjectId,
      query,
      matchCount: 6,
      threshold: 0.4,
      supabaseClient: supabase,
    });

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
