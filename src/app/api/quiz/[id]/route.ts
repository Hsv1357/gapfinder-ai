import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*, subjects(name), topics(title)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', id)
      .order('order_index', { ascending: true });

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    // Also fetch any existing answers if completed
    const { data: answers } = await supabase
      .from('quiz_answers')
      .select('*')
      .eq('quiz_id', id);

    const answerMap = new Map((answers || []).map((a: any) => [a.question_id, a]));

    const isCompleted = quiz.status === 'completed';

    const processedQuestions = questions.map((q: any) => {
      const studentAns = answerMap.get(q.id);
      if (isCompleted) {
        return {
          ...q,
          student_answer: studentAns || null,
        };
      }
      // Hide correct answer and explanation if still in progress
      return {
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
      };
    });

    return NextResponse.json({
      quiz,
      questions: processedQuestions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
