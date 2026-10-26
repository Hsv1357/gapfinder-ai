'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Map, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  Sparkles,
  Database,
  RefreshCw,
  FileText
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const fetchDashboardData = async (subjectId?: string) => {
    setLoading(true);
    try {
      const url = subjectId ? `/api/dashboard?subject_id=${subjectId}` : '/api/dashboard';
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
      if (json.activeSubjectId && !selectedSubjectId) {
        setSelectedSubjectId(json.activeSubjectId);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSubjectChange = (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
    fetchDashboardData(newSubjectId);
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Seed error:', err);
    } finally {
      setSeeding(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading student analytics & knowledge gap records...</p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const gaps = metrics.gaps || { weak: 0, medium: 0, strong: 0, notAssessed: 0 };
  const revision = metrics.revision || { hasPlan: false, totalTasks: 0, completedTasks: 0, remainingTasks: 0, progressPercentage: 0 };

  const barData = [
    { name: 'Weak (0-49%)', count: gaps.weak, color: '#f43f5e' },
    { name: 'Medium (50-79%)', count: gaps.medium, color: '#f59e0b' },
    { name: 'Strong (80-100%)', count: gaps.strong, color: '#10b981' },
    { name: 'Not Assessed', count: gaps.notAssessed, color: '#64748b' },
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Header & Subject Selector */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Student Learning Dashboard</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                Live Data
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time diagnostic mastery metrics calculated from source-grounded quiz assessments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {data?.subjects && data.subjects.length > 0 && (
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {data.subjects.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shrink-0"
              title="Loads demo Operating Systems course for judging demonstration"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{seeding ? 'Populating...' : 'Seed Demo Course'}</span>
            </button>
          </div>
        </div>

        {/* Empty state prompt if 0 documents */}
        {metrics.totalDocuments === 0 && (
          <div className="my-8 p-6 rounded-2xl glass-panel border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No course materials uploaded yet</h3>
                <p className="text-xs text-slate-400">
                  Upload your syllabus and lecture notes to begin diagnosis, or click &quot;Seed Demo Course&quot; to inspect with pre-built data.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link
                href="/materials"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shrink-0 text-center"
              >
                Upload Materials
              </Link>
              <button
                onClick={handleSeedDemo}
                disabled={seeding}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors shrink-0"
              >
                Load Sample Demo
              </button>
            </div>
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Card 1: Exam Target */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Exam Countdown</span>
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {metrics.daysToExam !== null ? `${metrics.daysToExam}` : '18'}
              </span>
              <span className="text-xs text-slate-400">days remaining</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 truncate">
              {metrics.examDate ? `Target: ${metrics.examDate}` : 'Semester Examination'}
            </p>
          </div>

          {/* Card 2: Knowledge Gaps */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Critical Knowledge Gaps</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-400">{gaps.weak}</span>
              <span className="text-xs text-slate-400">weak topics (&lt;50%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {gaps.medium} medium topics • {gaps.strong} strong topics
            </p>
          </div>

          {/* Card 3: Average Mastery */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Average Mastery</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {metrics.averageMastery}%
              </span>
              <span className="text-xs text-slate-400">assessed topics</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {metrics.assessedTopics} of {metrics.totalTopics} curriculum topics tested
            </p>
          </div>

          {/* Card 4: Revision Progress */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Revision Timetable</span>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-indigo-400">
                {revision.progressPercentage}%
              </span>
              <span className="text-xs text-slate-400">completed</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {revision.completedTasks} completed • {revision.remainingTasks} remaining tasks
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Chart 1: Topic Mastery Distribution */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Curriculum Gap Distribution</h3>
                <p className="text-xs text-slate-400">Classified by diagnostic testing evidence</p>
              </div>
              <Link href="/gaps" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                <span>View Full Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Topic Mastery Progression Over Time */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Diagnostic Score Trajectory</h3>
                <p className="text-xs text-slate-400">Historical performance from quiz submissions</p>
              </div>
              <Link href="/quiz" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                <span>Take Diagnostic</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="h-64 w-full">
              {data?.masteryTrend && data.masteryTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.masteryTrend} margin={{ left: -10, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="entry" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'Attempt #', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b' }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: any) => [`${val}%`, 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: '#38bdf8', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <TrendingUp className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">No quiz attempts recorded yet.</p>
                  <Link href="/quiz" className="mt-3 text-xs text-indigo-400 hover:underline">
                    Take your first diagnostic quiz &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Link
            href="/materials"
            className="glass-card p-4 rounded-xl border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white">Upload Materials</h4>
            <p className="text-xs text-slate-400 mt-1">Add syllabus, notes, or previous exam papers</p>
          </Link>

          <Link
            href="/topics"
            className="glass-card p-4 rounded-xl border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Map className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white">Curriculum Topic Map</h4>
            <p className="text-xs text-slate-400 mt-1">Inspect units, topics, and source associations</p>
          </Link>

          <Link
            href="/quiz"
            className="glass-card p-4 rounded-xl border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white">Diagnostic Quizzes</h4>
            <p className="text-xs text-slate-400 mt-1">Test topics with verified citation grounding</p>
          </Link>

          <Link
            href="/revision"
            className="glass-card p-4 rounded-xl border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white">Adaptive Revision Plan</h4>
            <p className="text-xs text-slate-400 mt-1">Review personalized timetable of weak topics</p>
          </Link>
        </div>

        {/* Recent Quizzes List */}
        <div className="mt-8 glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Recent Diagnostic Evaluations</span>
            </h3>
            <Link href="/quiz" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              Start New Test &rarr;
            </Link>
          </div>

          {data?.recentQuizzes && data.recentQuizzes.length > 0 ? (
            <div className="divide-y divide-slate-800/60">
              {data.recentQuizzes.map((quiz: any) => (
                <div key={quiz.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-medium text-slate-200">{quiz.title}</h5>
                    <p className="text-xs text-slate-500">
                      Completed on {new Date(quiz.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        (quiz.score_percentage || 0) >= 80
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : (quiz.score_percentage || 0) >= 50
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {quiz.score_percentage !== null ? `${quiz.score_percentage}%` : 'In Progress'}
                    </span>
                    <Link
                      href={`/quiz/${quiz.id}`}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      View Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">
              No recent quiz submissions. Take a diagnostic quiz to generate evidence for your gap report.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
