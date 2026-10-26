'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  Sparkles,
  BarChart3,
  Calendar
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { TopicMastery } from '@/types/database';

export default function GapsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'weak' | 'medium' | 'strong' | 'notAssessed'>('all');

  const fetchGaps = async () => {
    try {
      const res = await fetch('/api/gaps');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load gaps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGaps();
  }, []);

  const categories = data?.categories || { weak: [], medium: [], strong: [], notAssessed: [] };
  const summary = data?.summary || { weakCount: 0, mediumCount: 0, strongCount: 0, notAssessedCount: 0 };

  const getFilteredList = () => {
    if (activeTab === 'weak') return categories.weak;
    if (activeTab === 'medium') return categories.medium;
    if (activeTab === 'strong') return categories.strong;
    if (activeTab === 'notAssessed') return categories.notAssessed;
    return [
      ...categories.weak,
      ...categories.medium,
      ...categories.strong,
      ...categories.notAssessed,
    ];
  };

  const filteredTopics = getFilteredList();

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Knowledge Gap Diagnosis</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                Objective Assessment
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Curriculum topics classified into Weak, Medium, and Strong based on verifiable test evidence and scoring rubrics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/revision"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/25"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Generate Adaptive Timetable</span>
            </Link>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div
            onClick={() => setActiveTab('weak')}
            className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${
              activeTab === 'weak' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-800 hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
              <span>Weak Topics</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-rose-400">{summary.weakCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">0–49% Mastery • Critical Priority</p>
          </div>

          <div
            onClick={() => setActiveTab('medium')}
            className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${
              activeTab === 'medium' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
              <span>Medium Topics</span>
              <BarChart3 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-amber-400">{summary.mediumCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">50–79% Mastery • Moderate Priority</p>
          </div>

          <div
            onClick={() => setActiveTab('strong')}
            className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${
              activeTab === 'strong' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
              <span>Strong Topics</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-400">{summary.strongCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">80–100% Mastery • Spaced Review</p>
          </div>

          <div
            onClick={() => setActiveTab('notAssessed')}
            className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${
              activeTab === 'notAssessed' ? 'border-slate-500 bg-slate-800' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span>Not Assessed</span>
              <HelpCircle className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-slate-300">{summary.notAssessedCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">0 attempts • Baseline needed</p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Curriculum Topics ({data?.totalActionableTopics || 0})
          </button>
          <button
            onClick={() => setActiveTab('weak')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'weak'
                ? 'bg-rose-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Critical Weak Gaps ({summary.weakCount})
          </button>
          <button
            onClick={() => setActiveTab('medium')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'medium'
                ? 'bg-amber-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Medium ({summary.mediumCount})
          </button>
          <button
            onClick={() => setActiveTab('strong')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'strong'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Strong ({summary.strongCount})
          </button>
          <button
            onClick={() => setActiveTab('notAssessed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'notAssessed'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Untested ({summary.notAssessedCount})
          </button>
        </div>

        {/* Detailed Topic Cards */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500">Loading gap diagnosis...</div>
        ) : filteredTopics.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center mt-6">
            <p className="text-sm font-semibold text-white">No topics in this category.</p>
            <p className="text-xs text-slate-400 mt-1">
              Select another filter or take a diagnostic quiz to generate fresh assessments.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredTopics.map((item: any) => {
              const classification = item.classification || 'not_assessed';
              const isWeak = classification === 'weak';
              const isMedium = classification === 'medium';
              const isStrong = classification === 'strong';

              const badgeColor = isWeak
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : isMedium
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : isStrong
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700';

              return (
                <div
                  key={item.topic_id || item.id}
                  className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${badgeColor}`}>
                        {classification.replace('_', ' ')}
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {item.topic_title || item.title}
                      </h3>
                      <span className="text-xs text-slate-400">
                        ({item.subject_name || 'General'})
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      <span className="font-semibold text-slate-400">Diagnosis Rationale: </span>
                      {item.classification_reason || 'No diagnostic data recorded yet.'}
                    </p>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                      <span className="font-semibold text-indigo-300">Prescribed Next Action: </span>
                      <span className="text-slate-300">{item.suggested_next_action}</span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span>Tested: {item.total_questions_answered || 0} questions</span>
                      <span>•</span>
                      <span>Correct: {item.correct_answers || 0} answers</span>
                      <span>•</span>
                      <span>Mastery Score: {item.score_percentage || 0}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => router.push(`/quiz?topicId=${item.topic_id || item.id}`)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5"
                    >
                      <span>Diagnose / Retest</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
