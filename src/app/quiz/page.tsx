'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  AlertCircle, 
  BookOpen, 
  Sparkles, 
  RefreshCw, 
  ArrowRight, 
  FileCheck, 
  Award
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Quiz, QuizQuestion, RubricFeedback } from '@/types/database';

function QuizContent() {
  const searchParams = useSearchParams();
  const preselectedTopicId = searchParams.get('topicId');
  const preselectedDocId = searchParams.get('documentId');

  const [documents, setDocuments] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [diagnoseMode, setDiagnoseMode] = useState<'document' | 'topic'>('document');
  const [selectedDocId, setSelectedDocId] = useState<string>(preselectedDocId || '');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(preselectedTopicId || '');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  const [evaluationResults, setEvaluationResults] = useState<any[] | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch ready documents and extracted topics
  useEffect(() => {
    Promise.all([
      fetch('/api/materials').then((r) => r.json()).catch(() => ({})),
      fetch('/api/topics').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([matData, topData]) => {
        // Only allow documents that are ready and contain text chunks
        const readyDocs = (matData.documents || []).filter(
          (d: any) => d.processing_status === 'ready' && (d.total_chunks > 0 || d.total_pages > 0)
        );
        setDocuments(readyDocs);
        if (readyDocs.length > 0 && !selectedDocId) {
          setSelectedDocId(preselectedDocId || readyDocs[0].id);
        }

        if (topData.flatList) {
          const actionables = topData.flatList.filter((t: any) => t.level === 'topic' || t.level === 'subtopic');
          setTopics(actionables);
          if (actionables.length > 0 && !selectedTopicId) {
            setSelectedTopicId(preselectedTopicId || actionables[0].id);
          }
        }

        // If no ready documents but topics exist, default to topic mode
        if (readyDocs.length === 0 && topData.flatList && topData.flatList.length > 0) {
          setDiagnoseMode('topic');
        }
      })
      .finally(() => setLoadingInitial(false));
  }, []);

  const handleGenerateQuiz = async () => {
    if (generating) return;

    if (diagnoseMode === 'document' && !selectedDocId) {
      setErrorMsg('Please select a ready document to diagnose.');
      return;
    }
    if (diagnoseMode === 'topic' && !selectedTopicId) {
      setErrorMsg('Please select a curriculum topic to diagnose.');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setEvaluationResults(null);
    setAnswers({});

    try {
      const payload: any = {
        numMCQ: 3,
        numShortAnswer: 2,
      };

      if (diagnoseMode === 'document') {
        payload.documentId = selectedDocId;
      } else {
        payload.topicId = selectedTopicId;
      }

      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to generate grounded quiz.');
      } else {
        setActiveQuiz(data.quiz);
        setQuestions(data.questions || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with quiz generator.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswerChange = (questionId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/quiz/${activeQuiz.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit and evaluate quiz.');
      } else {
        setFinalScore(data.overallPercentage);
        setEvaluationResults(data.evaluations);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting answers.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Diagnostic Quiz Assessment</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
              Source-Grounded RAG
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Questions synthesized strictly from retrieved textbook passages with exact citations. Evaluated deterministically and via criteria rubrics.
          </p>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Phase 1: Assessment Target Selection Card (if no active quiz) */}
        {!activeQuiz && (
          <div className="mt-8 glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>Configure Diagnostic Assessment</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Synthesizes diagnostic questions strictly from your uploaded course materials. Refuses to use pre-written mock questions.
            </p>

            {loadingInitial ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Checking indexed documents and curriculum topics...</span>
              </div>
            ) : documents.length === 0 && topics.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <FileCheck className="w-10 h-10 text-slate-500 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No Study Materials Ready for Diagnosis</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  To start a source-grounded diagnostic quiz, please upload a syllabus, lecture notes, or textbook chapter on the Materials page.
                </p>
                <div className="pt-2">
                  <Link
                    href="/materials"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    <span>Upload Study Materials</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-w-lg">
                {/* Mode Selector Tabs (Document vs Topic) */}
                <div className="flex items-center gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setDiagnoseMode('document')}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                      diagnoseMode === 'document'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Diagnose by Document ({documents.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiagnoseMode('topic')}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                      diagnoseMode === 'topic'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Diagnose by Topic ({topics.length})</span>
                  </button>
                </div>

                {/* Document Selector */}
                {diagnoseMode === 'document' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Select Ready Uploaded Document
                    </label>
                    {documents.length > 0 ? (
                      <select
                        value={selectedDocId}
                        onChange={(e) => setSelectedDocId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-sm rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title} • {d.total_chunks} chunks ({d.total_pages || 1} pages)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                        No fully indexed documents found yet.{' '}
                        <Link href="/materials" className="text-indigo-400 underline font-medium">
                          Upload a document
                        </Link>{' '}
                        to diagnose.
                      </div>
                    )}
                  </div>
                )}

                {/* Topic Selector */}
                {diagnoseMode === 'topic' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Select Curriculum Topic
                    </label>
                    {topics.length > 0 ? (
                      <select
                        value={selectedTopicId}
                        onChange={(e) => setSelectedTopicId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-sm rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.mastery?.classification || 'not assessed'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                        No curriculum topics extracted yet.{' '}
                        <Link href="/materials" className="text-indigo-400 underline font-medium">
                          Extract topics from your syllabus
                        </Link>{' '}
                        or switch to &quot;Diagnose by Document&quot; above.
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">Format: 3 Multiple Choice + 2 Conceptual Short-Answer</p>
                  <p className="text-[11px] text-slate-500">
                    Questions cite specific source passages. Correct answers remain securely on the server until submission.
                  </p>
                </div>

                <button
                  onClick={handleGenerateQuiz}
                  disabled={
                    generating ||
                    (diagnoseMode === 'document' && !selectedDocId) ||
                    (diagnoseMode === 'topic' && !selectedTopicId)
                  }
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Retrieving Passages & Generating Grounded Questions...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Begin Diagnostic Quiz</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Active Quiz Taking Form */}
        {activeQuiz && !evaluationResults && (
          <div className="mt-8 space-y-6">
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{activeQuiz.title}</h3>
                <p className="text-xs text-slate-400">{questions.length} questions derived from course materials</p>
              </div>
              <button
                onClick={() => setActiveQuiz(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((q, index) => (
                <div key={q.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Question {index + 1} of {questions.length} • {q.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase border border-slate-700">
                      {q.difficulty}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                    {q.question_text}
                  </p>

                  {/* MCQ Options */}
                  {q.question_type === 'multiple_choice' && q.options && (
                    <div className="space-y-2 mt-3">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <label
                            key={optIdx}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value={opt}
                              checked={isSelected}
                              onChange={() => handleAnswerChange(q.id, opt)}
                              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs sm:text-sm">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Short Answer Input */}
                  {q.question_type === 'short_answer' && (
                    <div className="mt-3">
                      <textarea
                        rows={4}
                        value={answers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Write your answer explaining the principles and mechanisms..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Citation: &quot;{q.citation_document_title}&quot;{q.citation_page ? ` (Page ${q.citation_page})` : ''}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {Object.keys(answers).length} of {questions.length} answered
              </span>

              <button
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating Answers with Rubric...</span>
                  </>
                ) : (
                  <>
                    <span>Submit for Diagnosis</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Phase 3: Evaluated Results & Gap Breakdown */}
        {evaluationResults && (
          <div className="mt-8 space-y-6">
            {/* Score Banner */}
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-sky-400 mx-auto flex items-center justify-center text-white mb-3 shadow-xl shadow-indigo-500/30">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Diagnostic Score: {finalScore}%
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your Knowledge Gap Report and Adaptive Revision Plan have been automatically updated.
              </p>

              <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
                <Link
                  href="/gaps"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  View Gap Report &rarr;
                </Link>
                <Link
                  href="/revision"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Inspect Revision Timetable
                </Link>
                <button
                  onClick={() => {
                    setActiveQuiz(null);
                    setEvaluationResults(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Take Another Quiz
                </button>
              </div>
            </div>

            {/* Questions Review with Rubric Feedback */}
            <h3 className="text-base font-bold text-white pt-4">Question-by-Question Evaluation Breakdown</h3>

            <div className="space-y-6">
              {evaluationResults.map((item, idx) => {
                const q = item.question;
                const evalData = item.evaluation;
                const isCorrect = evalData.isCorrect;
                const rubric: RubricFeedback = evalData.rubricFeedback;

                return (
                  <div
                    key={q.id}
                    className={`glass-panel p-6 rounded-2xl border transition-all ${
                      isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Question {idx + 1}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          isCorrect
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isCorrect ? 'Correct (1.0)' : `Score: ${evalData.score.toFixed(1)} / 1.0`}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white mb-4">{q.question_text}</p>

                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="font-semibold text-slate-400">Your Answer:</span>
                        <p className="text-slate-200 mt-1">{answers[q.id] || '(No response provided)'}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="font-semibold text-emerald-400">Verified Correct Answer:</span>
                        <p className="text-slate-200 mt-1">{q.correct_answer}</p>
                      </div>

                      {/* Rubric evaluation notes */}
                      {rubric && (
                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                          <p className="font-semibold text-indigo-300">Rubric Feedback & Reasoning:</p>
                          <p className="text-slate-300">{rubric.reasoning}</p>

                          {rubric.key_points_identified && rubric.key_points_identified.length > 0 && (
                            <div className="text-emerald-400">
                              <span className="font-semibold">Key Points Identified: </span>
                              {rubric.key_points_identified.join(', ')}
                            </div>
                          )}

                          {rubric.missed_points && rubric.missed_points.length > 0 && (
                            <div className="text-rose-400">
                              <span className="font-semibold">Omissions / Gaps: </span>
                              {rubric.missed_points.join(', ')}
                            </div>
                          )}

                          {rubric.suggested_improvement && (
                            <p className="text-slate-400 italic pt-1">
                              Advice: {rubric.suggested_improvement}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Source Citation Box */}
                      {q.citation_passage && (
                        <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-1">
                          <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Source Passage & Verbatim Citation</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            Source: {q.citation_document_title}{q.citation_page ? ` (Page ${q.citation_page})` : ''}
                          </p>
                          <p className="text-slate-300 italic pt-1 border-t border-indigo-500/10">
                            &quot;{q.citation_passage}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16]" />}>
      <QuizContent />
    </Suspense>
  );
}
