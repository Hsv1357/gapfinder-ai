'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Map, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Sparkles,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Topic } from '@/types/database';

export default function TopicsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      if (res.ok) {
        setUnits(data.topics || []);
        // Expand all units by default
        const allUnitIds = new Set<string>((data.topics || []).map((u: Topic) => u.id));
        setExpandedUnits(allUnitIds);
      }
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const toggleUnit = (unitId: string) => {
    const next = new Set(expandedUnits);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    setExpandedUnits(next);
  };

  const getMasteryBadge = (mastery?: any) => {
    if (!mastery || mastery.classification === 'not_assessed' || mastery.total_questions_answered === 0) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          Not Assessed
        </span>
      );
    }
    if (mastery.classification === 'weak') {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Weak ({mastery.score_percentage}%)</span>
        </span>
      );
    }
    if (mastery.classification === 'medium') {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Medium ({mastery.score_percentage}%)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
        <CheckCircle2 className="w-2.5 h-2.5" />
        <span>Strong ({mastery.score_percentage}%)</span>
      </span>
    );
  };

  const getImportanceBadge = (importance: string) => {
    if (importance === 'high') {
      return <span className="text-[10px] font-bold text-rose-400">High Weightage</span>;
    }
    if (importance === 'low') {
      return <span className="text-[10px] text-slate-500">Low Weightage</span>;
    }
    return <span className="text-[10px] text-slate-400">Medium Weightage</span>;
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Curriculum Topic Map</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                Syllabus Architecture
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Hierarchical map of academic units, core topics, and subtopics tagged with verified knowledge gap ratings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/materials"
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              Upload Syllabus
            </Link>
            <Link
              href="/quiz"
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Take Comprehensive Diagnostic
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500">Loading topic tree...</div>
        ) : units.length === 0 ? (
          <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center mt-8">
            <Map className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No topics mapped yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-6">
              Upload a syllabus file on the Materials page and click &quot;Extract Topics&quot; to automatically build your structured curriculum map.
            </p>
            <Link
              href="/materials"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              Go to Materials
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {units.map((unit) => {
              const isExpanded = expandedUnits.has(unit.id);
              return (
                <div key={unit.id} className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                  {/* Unit Header */}
                  <div
                    onClick={() => toggleUnit(unit.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <button className="p-1 rounded-md text-slate-400 hover:text-white">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Unit
                          </span>
                          <h3 className="text-base font-bold text-white">{unit.title}</h3>
                          {getImportanceBadge(unit.estimated_importance)}
                        </div>
                        {unit.description && (
                          <p className="text-xs text-slate-400 mt-1">{unit.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400">
                        {unit.children?.length || 0} topics
                      </span>
                    </div>
                  </div>

                  {/* Subtopics List */}
                  {isExpanded && unit.children && unit.children.length > 0 && (
                    <div className="divide-y divide-slate-800/60 bg-slate-950/40 border-t border-slate-800">
                      {unit.children.map((topic) => (
                        <div
                          key={topic.id}
                          className="p-4 sm:pl-12 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-slate-200">{topic.title}</h4>
                              {getMasteryBadge(topic.mastery)}
                              {getImportanceBadge(topic.estimated_importance)}
                            </div>
                            {topic.mastery?.classification_reason ? (
                              <p className="text-xs text-slate-400 italic">
                                &quot;{topic.mastery.classification_reason}&quot;
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500">
                                Untested topic. Diagnostic test required to evaluate knowledge retention.
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <Link
                              href={`/explain?topic=${encodeURIComponent(topic.title)}`}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                              Explain Topic
                            </Link>

                            <button
                              onClick={() => router.push(`/quiz?topicId=${topic.id}`)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1"
                            >
                              <span>Diagnose Gap</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
