'use client';

import { useState, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  Award,
  RefreshCw 
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

function QuizDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quiz/${quizId}`)
      .then((r) => r.json())
      .then((data) => {
        setQuiz(data.quiz);
        setQuestions(data.questions || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-xs text-slate-400">Loading quiz assessment review...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h2 className="text-lg font-bold text-white">Quiz not found</h2>
          <Link href="/dashboard" className="mt-4 text-xs text-indigo-400 hover:underline inline-block">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Header */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{quiz.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Completed on {new Date(quiz.completed_at || quiz.created_at).toLocaleDateString()} • {questions.length} Questions
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-indigo-400">
              {quiz.score_percentage !== null ? `${quiz.score_percentage}%` : 'N/A'}
            </span>
            <p className="text-[10px] text-slate-400">Overall Score</p>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-6">
          {questions.map((q, idx) => {
            const studentAns = q.student_answer;
            const isCorrect = studentAns?.is_correct ?? false;
            const rubric = studentAns?.rubric_feedback;

            return (
              <div
                key={q.id}
                className={`glass-panel p-6 rounded-2xl border ${
                  isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    Question {idx + 1}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      isCorrect
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {isCorrect ? 'Correct' : `Score: ${studentAns?.score ?? 0} / 1.0`}
                  </span>
                </div>

                <p className="text-sm font-semibold text-white mb-4">{q.question_text}</p>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="font-semibold text-slate-400">Student Response:</span>
                    <p className="text-slate-200 mt-1">{studentAns?.student_answer || '(No answer provided)'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="font-semibold text-emerald-400">Expected Correct Answer:</span>
                    <p className="text-slate-200 mt-1">{q.correct_answer}</p>
                  </div>

                  {rubric && (
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <p className="font-semibold text-indigo-300">Feedback Rationale:</p>
                      <p className="text-slate-300">{rubric.reasoning}</p>
                    </div>
                  )}

                  {q.citation_passage && (
                    <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Verbatim Citation: {q.citation_document_title} (Page {q.citation_page})</span>
                      </div>
                      <p className="text-slate-300 italic pt-1 text-[11px]">
                        &quot;{q.citation_passage}&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16]" />}>
      <QuizDetailContent params={params} />
    </Suspense>
  );
}
