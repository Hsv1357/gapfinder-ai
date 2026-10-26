import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { DEMO_COURSE } from '@/lib/demo-data';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in first.' }, { status: 401 });
    }

    // 1. Create Demo Subject
    const { data: subject, error: subErr } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        name: DEMO_COURSE.subject.name,
        code: DEMO_COURSE.subject.code,
        description: DEMO_COURSE.subject.description,
        exam_date: DEMO_COURSE.subject.examDate,
      })
      .select()
      .single();

    if (subErr || !subject) {
      return NextResponse.json({ error: `Subject creation failed: ${subErr?.message}` }, { status: 500 });
    }

    // 2. Insert Documents and Chunks
    const docMap = new Map<string, string>();

    for (const d of DEMO_COURSE.documents) {
      const { data: docRecord } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          subject_id: subject.id,
          title: d.title,
          file_name: d.file_name,
          file_type: d.file_type,
          file_size: 1024 * 1024 * 2,
          processing_status: 'ready',
          total_pages: d.total_pages,
          total_chunks: d.total_chunks,
        })
        .select()
        .single();

      if (docRecord) {
        docMap.set(d.title, docRecord.id);

        // Insert sample grounding chunks for this document
        await supabase.from('document_chunks').insert([
          {
            document_id: docRecord.id,
            user_id: user.id,
            subject_id: subject.id,
            chunk_index: 0,
            page_number: 1,
            section_title: 'Overview',
            content: `Core concepts and foundational principles for ${d.title}. Includes definitions, theorems, and practical operational architectures in system design.`,
            token_count: 50,
          },
          {
            document_id: docRecord.id,
            user_id: user.id,
            subject_id: subject.id,
            chunk_index: 1,
            page_number: 14,
            section_title: 'Deadlock Avoidance & Banker Algorithm',
            content: `Definition: A state is safe if there exists a safe sequence <P1, P2, ..., Pn> of processes such that for each Pi, the resources that Pi can still request can be satisfied by currently available resources plus resources held by all Pj with j < i. When a process requests resources, the OS evaluates whether granting the request leaves the system in a safe state.`,
            token_count: 75,
          },
        ]);
      }
    }

    // 3. Insert Topics and Mastery records
    const insertedTopics: any[] = [];
    const planningTopicsList: any[] = [];
    let orderIndex = 1;

    for (const unit of DEMO_COURSE.topics) {
      const { data: unitRecord } = await supabase
        .from('topics')
        .insert({
          user_id: user.id,
          subject_id: subject.id,
          title: unit.title,
          level: 'unit',
          order_index: orderIndex++,
          description: unit.description,
          estimated_importance: unit.estimated_importance,
        })
        .select()
        .single();

      if (!unitRecord) continue;

      for (const sub of unit.subtopics) {
        const { data: topicRecord } = await supabase
          .from('topics')
          .insert({
            user_id: user.id,
            subject_id: subject.id,
            parent_id: unitRecord.id,
            title: sub.title,
            level: 'topic',
            order_index: orderIndex++,
            estimated_importance: sub.estimated_importance,
          })
          .select()
          .single();

        if (!topicRecord) continue;
        insertedTopics.push(topicRecord);

        planningTopicsList.push({
          id: topicRecord.id,
          title: topicRecord.title,
          importance: sub.estimated_importance,
          classification: sub.classification,
          scorePercentage: sub.initialScore,
          sourceDocTitle: DEMO_COURSE.documents[1].title,
        });

        // Insert Topic Mastery
        await supabase.from('topic_mastery').insert({
          user_id: user.id,
          topic_id: topicRecord.id,
          subject_id: subject.id,
          score_percentage: sub.initialScore,
          classification: sub.classification,
          total_questions_answered: sub.classification === 'not_assessed' ? 0 : 5,
          correct_answers: Math.round((sub.initialScore / 100) * 5),
          classification_reason: sub.reason,
          suggested_next_action: sub.nextAction,
          supporting_evidence: sub.classification === 'not_assessed' ? [] : [
            {
              quiz_id: 'demo-diagnostic-1',
              score: Math.round((sub.initialScore / 100) * 5),
              total: 5,
              date: new Date().toISOString(),
            },
          ],
        });

        // Record history
        if (sub.classification !== 'not_assessed') {
          await supabase.from('topic_mastery_history').insert({
            user_id: user.id,
            topic_id: topicRecord.id,
            score_percentage: sub.initialScore,
            classification: sub.classification,
          });
        }
      }
    }

    // 4. Create a Sample Diagnostic Quiz
    const weakTopic = insertedTopics.find((t) => t.title.includes('Banker'));
    const targetTopicId = weakTopic?.id || insertedTopics[0]?.id;

    const { data: demoQuiz } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        subject_id: subject.id,
        topic_id: targetTopicId,
        title: `Diagnostic Quiz: Concurrency & Deadlocks`,
        quiz_type: 'diagnostic',
        status: 'completed',
        total_questions: DEMO_COURSE.sampleQuestions.length,
        score_percentage: 50,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (demoQuiz) {
      for (let i = 0; i < DEMO_COURSE.sampleQuestions.length; i++) {
        const sq = DEMO_COURSE.sampleQuestions[i];
        const { data: qRecord } = await supabase
          .from('quiz_questions')
          .insert({
            quiz_id: demoQuiz.id,
            user_id: user.id,
            topic_id: targetTopicId,
            question_text: sq.question_text,
            question_type: sq.question_type,
            options: sq.options,
            correct_answer: sq.correct_answer,
            explanation: sq.explanation,
            difficulty: sq.difficulty,
            citation_document_title: sq.citation_document_title,
            citation_page: sq.citation_page,
            citation_passage: sq.citation_passage,
            order_index: i + 1,
          })
          .select()
          .single();

        if (qRecord) {
          // Record sample answer
          const isCorrect = i === 0; // First question correct, second partial
          await supabase.from('quiz_answers').insert({
            quiz_id: demoQuiz.id,
            question_id: qRecord.id,
            user_id: user.id,
            student_answer: isCorrect ? sq.correct_answer : 'Deadlock avoidance means using semaphores to lock things.',
            is_correct: isCorrect,
            score: isCorrect ? 1.0 : 0.0,
            max_score: 1.0,
            rubric_feedback: {
              score: isCorrect ? 1.0 : 0.0,
              maxScore: 1.0,
              isCorrect,
              key_points_identified: isCorrect ? ['Selected the valid safe sequence definition'] : [],
              missed_points: isCorrect ? [] : ['Omitted distinction between elimination of Coffman conditions vs dynamic resource inspection'],
              reasoning: isCorrect
                ? 'Correctly identified the safe state criteria from Dijkstra’s algorithm.'
                : 'Misidentified avoidance mechanism; semaphores are an IPC primitive, not the avoidance algorithm itself.',
              suggested_improvement: 'Review Chapter 7 notes on the Banker’s Algorithm.',
            },
          });
        }
      }
    }

    // 5. Generate and insert Revision Plan
    const { data: planRecord } = await supabase
      .from('revision_plans')
      .insert({
        user_id: user.id,
        subject_id: subject.id,
        title: `${DEMO_COURSE.subject.name} Adaptive Revision Plan`,
        exam_date: DEMO_COURSE.subject.examDate,
        daily_study_hours: 3.0,
        total_tasks: 4,
        completed_tasks: 1,
        status: 'active',
      })
      .select()
      .single();

    if (planRecord) {
      await supabase.from('revision_tasks').insert([
        {
          plan_id: planRecord.id,
          user_id: user.id,
          topic_id: targetTopicId,
          priority: 'high',
          scheduled_date: new Date().toISOString().split('T')[0],
          estimated_duration_minutes: 60,
          suggested_activity: 'Priority Deep-Dive: Review Banker’s Algorithm worked matrix safety algorithm calculations in Unit 2 notes.',
          source_material_reference: 'Unit 2: Process Synchronization & Deadlock Notes (Page 14)',
          status: 'completed',
          order_index: 1,
          completed_at: new Date().toISOString(),
        },
        {
          plan_id: planRecord.id,
          user_id: user.id,
          topic_id: targetTopicId,
          priority: 'high',
          scheduled_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          estimated_duration_minutes: 30,
          suggested_activity: 'Diagnostic Re-Evaluation: Retake Concurrency & Deadlock diagnostic quiz to verify gap closure.',
          source_material_reference: 'Unit 2: Process Synchronization & Deadlock Notes',
          status: 'pending',
          order_index: 2,
        },
        {
          plan_id: planRecord.id,
          user_id: user.id,
          topic_id: insertedTopics[1]?.id || null,
          priority: 'medium',
          scheduled_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
          estimated_duration_minutes: 45,
          suggested_activity: 'Targeted Problem Solving: Work through Gantt chart turnaround and waiting times for SJF with aging.',
          source_material_reference: 'Unit 1: Process Management Notes',
          status: 'pending',
          order_index: 3,
        },
        {
          plan_id: planRecord.id,
          user_id: user.id,
          topic_id: insertedTopics[2]?.id || null,
          priority: 'low',
          scheduled_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          estimated_duration_minutes: 30,
          suggested_activity: 'Active Recall & Spaced Retention: 15-minute quick flash review of Belady’s anomaly on FIFO.',
          source_material_reference: 'Unit 3: Virtual Memory Notes',
          status: 'pending',
          order_index: 4,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      subjectId: subject.id,
      subjectName: subject.name,
      message: 'Demo course seeded successfully with real curriculum hierarchy, diagnostic results, knowledge gap report, and adaptive revision plan.',
    });
  } catch (err: any) {
    console.error('Demo seed error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
