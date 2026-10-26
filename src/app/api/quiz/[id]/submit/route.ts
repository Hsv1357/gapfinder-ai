import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { evaluateAnswer } from '@/lib/quiz/evaluator';
import { classifyTopicMastery } from '@/lib/gap-analysis/classifier';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { answers } = await req.json(); // { [questionId: string]: string }

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Missing submitted answers payload.' }, { status: 400 });
    }

    // 1. Fetch Quiz and Questions with correct answers
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*, topics(id, title), subjects(id, name)')
      .eq('id', quizId)
      .eq('user_id', user.id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    if (qError || !questions) {
      return NextResponse.json({ error: 'Could not fetch quiz questions.' }, { status: 500 });
    }

    let totalPointsEarned = 0;
    const maxTotalPoints = questions.length;
    const answerRecords = [];
    const evaluatedResults = [];

    // 2. Evaluate each question
    for (const q of questions) {
      const studentInput = (answers[q.id] || '').trim();

      const evaluation = await evaluateAnswer({
        questionType: q.question_type,
        questionText: q.question_text,
        expectedAnswer: q.correct_answer,
        studentAnswer: studentInput,
        sourcePassage: q.citation_passage,
        explanation: q.explanation,
      });

      totalPointsEarned += evaluation.score;

      const record = {
        quiz_id: quizId,
        question_id: q.id,
        user_id: user.id,
        student_answer: studentInput,
        is_correct: evaluation.isCorrect,
        score: evaluation.score,
        max_score: 1.0,
        rubric_feedback: evaluation.rubricFeedback,
      };

      answerRecords.push(record);
      evaluatedResults.push({
        question: q,
        evaluation,
      });
    }

    // 3. Save answers to database
    // Delete any prior answers for this quiz if re-submitting
    await supabase.from('quiz_answers').delete().eq('quiz_id', quizId);
    const { error: saveAnswersError } = await supabase
      .from('quiz_answers')
      .insert(answerRecords);

    if (saveAnswersError) {
      console.error('Failed to save answers:', saveAnswersError);
    }

    // 4. Update Quiz status & percentage
    const overallPercentage = Math.round((totalPointsEarned / maxTotalPoints) * 100);
    const completedAt = new Date().toISOString();

    await supabase
      .from('quizzes')
      .update({
        status: 'completed',
        score_percentage: overallPercentage,
        completed_at: completedAt,
      })
      .eq('id', quizId);

    // 5. Update Topic Mastery and Gap Report
    let targetTopicId = quiz.topic_id;
    let topicTitle = quiz.topics?.title;

    if (!targetTopicId && quiz.subject_id) {
      // Find an existing topic in this subject
      const { data: subjectTopics } = await supabase
        .from('topics')
        .select('id, title')
        .eq('subject_id', quiz.subject_id)
        .eq('user_id', user.id)
        .in('level', ['topic', 'subtopic'])
        .limit(1);

      if (subjectTopics && subjectTopics.length > 0) {
        targetTopicId = subjectTopics[0].id;
        topicTitle = subjectTopics[0].title;
      } else {
        // Create an initial topic representing this assessed material
        const cleanTitle = quiz.title.replace(/^Diagnostic Quiz:\s*/i, '');
        const { data: newTopic } = await supabase
          .from('topics')
          .insert({
            user_id: user.id,
            subject_id: quiz.subject_id,
            title: cleanTitle,
            level: 'topic',
            order_index: 1,
            estimated_importance: 'high',
          })
          .select()
          .single();

        if (newTopic) {
          targetTopicId = newTopic.id;
          topicTitle = newTopic.title;
          await supabase.from('quizzes').update({ topic_id: targetTopicId }).eq('id', quizId);
        }
      }
    }

    if (targetTopicId) {
      // Fetch all historical quiz answers for this topic
      const { data: pastAnswers } = await supabase
        .from('quiz_answers')
        .select('score, max_score, submitted_at, quiz_id, quiz_questions(difficulty)')
        .eq('user_id', user.id)
        .eq('quiz_questions.topic_id', targetTopicId);

      const attempts = (pastAnswers || []).map((a: any) => ({
        quizId: a.quiz_id,
        score: Number(a.score) || 0,
        maxScore: Number(a.max_score) || 1.0,
        difficulty: a.quiz_questions?.difficulty || 'medium',
        date: a.submitted_at,
      }));

      // Ensure the current attempt is represented
      attempts.push({
        quizId,
        score: totalPointsEarned,
        maxScore: maxTotalPoints,
        difficulty: 'medium',
        date: completedAt,
      });

      const gapAnalysis = classifyTopicMastery(topicTitle || 'Course Topic', attempts);

      // Upsert topic_mastery
      await supabase
        .from('topic_mastery')
        .upsert(
          {
            user_id: user.id,
            topic_id: targetTopicId,
            subject_id: quiz.subject_id,
            score_percentage: gapAnalysis.scorePercentage,
            classification: gapAnalysis.classification,
            total_questions_answered: gapAnalysis.totalQuestions,
            correct_answers: gapAnalysis.correctAnswers,
            classification_reason: gapAnalysis.reason,
            suggested_next_action: gapAnalysis.suggestedNextAction,
            supporting_evidence: attempts.slice(-10),
            last_assessed_at: completedAt,
            updated_at: completedAt,
          },
          { onConflict: 'user_id,topic_id' }
        );

      // Record in topic mastery history
      await supabase.from('topic_mastery_history').insert({
        user_id: user.id,
        topic_id: targetTopicId,
        score_percentage: gapAnalysis.scorePercentage,
        classification: gapAnalysis.classification,
        recorded_at: completedAt,
      });
    }

    return NextResponse.json({
      success: true,
      quizId,
      overallPercentage,
      totalPointsEarned,
      maxTotalPoints,
      completedAt,
      evaluations: evaluatedResults,
    });
  } catch (err: any) {
    console.error('Quiz submission error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
