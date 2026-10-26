'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  BookOpen, 
  Layers,
  ArrowRight
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { RevisionPlan, RevisionTask } from '@/types/database';

export default function RevisionPage() {
  const [plan, setPlan] = useState<RevisionPlan | null>(null);
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState('3.0');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPlan = async () => {
    try {
      const res = await fetch('/api/revision');
      const data = await res.json();
      if (data.plan) {
        setPlan(data.plan);
        setTasks(data.tasks || []);
        setExamDate(data.plan.exam_date);
        setDailyHours(String(data.plan.daily_study_hours));
        setSelectedSubjectId(data.plan.subject_id);
      }
    } catch (err) {
      console.error('Failed to load plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.subjects) {
        setSubjects(data.subjects);
        if (!selectedSubjectId && data.subjects.length > 0) {
          setSelectedSubjectId(data.subjects[0].id);
          if (data.subjects[0].exam_date && !examDate) {
            setExamDate(data.subjects[0].exam_date);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPlan();
    fetchSubjects();
  }, []);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !examDate) {
      setErrorMsg('Please select a subject and target examination date.');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setWarning(null);

    try {
      const res = await fetch('/api/revision/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          examDate,
          dailyStudyHours: parseFloat(dailyHours) || 3.0,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to generate revision timetable.');
      } else {
        setPlan(data.plan);
        setTasks(data.tasks || []);
        if (data.feasibilityWarning) {
          setWarning(data.feasibilityWarning);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with revision engine.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setUpdatingTaskId(taskId);

    try {
      const res = await fetch(`/api/revision/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();

      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as any } : t))
        );
        if (plan) {
          setPlan({ ...plan, completed_tasks: data.completedCount });
        }
      }
    } catch (err) {
      console.error('Toggle task error:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Adaptive Revision Planner</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Personalized Timetable
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Dynamic study schedule allocating intensive deep-dives to weak knowledge gaps and spaced reviews to strong topics.
          </p>
        </div>

        {/* Schedule capacity warning if student has too little time before exam */}
        {warning && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">Study Capacity Warning</p>
              <p className="mt-0.5 text-slate-300 leading-relaxed">{warning}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
          {/* Plan Settings Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 h-fit">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span>Timetable Parameters</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Configure your exam date and daily study availability to calibrate study sessions.
            </p>

            <form onSubmit={handleGeneratePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Course
                </label>
                {subjects.length > 0 ? (
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500">No courses created yet.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Examination Deadline Date
                </label>
                <input
                  type="date"
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span>Available Study Hours / Day</span>
                  <span className="text-indigo-400">{dailyHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8.0"
                  step="0.5"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>30 mins</span>
                  <span>4 hrs</span>
                  <span>8 hrs</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-indigo-300">Allocation Hierarchy:</p>
                <p>• Weak Topics: 60 min Deep-Dive + 30 min Retest</p>
                <p>• Medium Topics: 45 min Targeted Problem Practice</p>
                <p>• Strong Topics: 30 min Active Recall Spaced Review</p>
              </div>

              <button
                type="submit"
                disabled={generating || !selectedSubjectId}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recalculating Timetable...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Adaptive Plan</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Timetable Tasks Feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Scheduled Study Tasks ({tasks.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {completedCount} of {tasks.length} tasks completed ({progressPercent}%)
                </p>
              </div>

              {plan && (
                <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-20 text-center text-xs text-slate-500">Loading revision plan...</div>
            ) : tasks.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
                <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">No active revision timetable</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
                  Select your exam date and click &quot;Generate Adaptive Plan&quot; to build a schedule tailored to your knowledge gaps.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  const isHigh = task.priority === 'high';
                  const isMedium = task.priority === 'medium';

                  const priorityBadge = isHigh
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : isMedium
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                  return (
                    <div
                      key={task.id}
                      className={`glass-panel p-4 rounded-xl border transition-all ${
                        isCompleted
                          ? 'border-slate-800/60 bg-slate-950/30 opacity-75'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleToggleTask(task.id, task.status)}
                            disabled={updatingTaskId === task.id}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isCompleted
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-600 hover:border-indigo-400 bg-slate-900'
                            }`}
                          >
                            {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${priorityBadge}`}>
                                {task.priority} Priority
                              </span>
                              <h4
                                className={`text-sm font-semibold text-white ${
                                  isCompleted ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                {task.topic_title}
                              </h4>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed">
                              {task.suggested_activity}
                            </p>

                            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Calendar className="w-3 h-3 text-indigo-400" />
                                <span>Scheduled: {task.scheduled_date}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3 text-sky-400" />
                                <span>{task.estimated_duration_minutes} mins</span>
                              </span>
                            </div>

                            {task.source_material_reference && (
                              <p className="text-[10px] text-indigo-300 pt-0.5 flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                <span>{task.source_material_reference}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
