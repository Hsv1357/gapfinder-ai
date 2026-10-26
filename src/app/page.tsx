'use client';

import Link from 'next/link';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  BookOpen, 
  Layers, 
  FileCheck, 
  BarChart3, 
  ShieldCheck, 
  ChevronRight,
  BrainCircuit
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
        {/* Glow gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-sky-500/15 to-purple-600/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 mb-8 backdrop-blur-md animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Powered Learning Diagnosis & Adaptive Revision</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
            Find what you don&apos;t know{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200">
              before your exam does.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Upload your syllabus, lecture notes, textbook chapters, and past papers. GapFinder AI runs source-grounded diagnostic quizzes, maps your knowledge gaps into Weak, Medium, and Strong topics, and builds an adaptive daily revision plan.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <span>Start Free Diagnosis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Student Dashboard</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Core differentiator banner */}
          <div className="mt-12 inline-flex items-center gap-6 px-6 py-3 rounded-2xl glass-card text-xs text-slate-300 border border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Not a generic Chat-with-PDF</span>
            </div>
            <div className="hidden sm:block h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Zero-Hallucination Citations</span>
            </div>
            <div className="hidden sm:block h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Adaptive Spaced Timetabling</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Platform Preview */}
      <section className="py-12 border-y border-slate-800/80 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400">The Diagnostic Pipeline</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">How GapFinder AI Pinpoints Weak Topics</p>
            <p className="mt-3 text-slate-400 text-sm">
              From raw course documents to pinpointed mastery reports and an adaptive daily study timetable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Syllabus & Material RAG Indexing</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Textbooks and lecture notes are parsed page-by-page. Content is chunked with overlap and mapped into high-dimensional vector embeddings, preserving source document titles and page numbers.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center text-xs text-indigo-400 font-medium">
                <FileCheck className="w-3.5 h-3.5 mr-1.5" />
                <span>Page-Preserving pgvector index</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Grounded Diagnostic Quizzes</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Rather than generic quizzes, questions are synthesized strictly from retrieved textbook passages with exact verbatim citations. Multiple-choice and rubric-evaluated short-answer questions challenge actual understanding.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center text-xs text-amber-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Deterministic & Rubric Grading</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Knowledge Gap Report & Timetable</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Topics are classified into Weak (0-49%), Medium (50-79%), and Strong (80-100%). The system builds a personalized revision plan prioritizing high-impact weak topics before your exam deadline.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center text-xs text-emerald-400 font-medium">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                <span>Adaptive Spaced Timetabling</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Details Section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Evidence-Based Gap Classification</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                No guessing. Every topic rating is backed by verifiable quiz evidence.
              </h2>
              <p className="mt-4 text-slate-300 leading-relaxed">
                Most revision tools give students a false sense of security through passive reading. GapFinder AI forces active recall, evaluates key criteria against exact textbook evidence, and only marks a topic &quot;Strong&quot; when verified across varied difficulty levels.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">W</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Weak Topics (0–49%)</h4>
                    <p className="text-xs text-slate-400">Allocated high-priority 60-minute deep-dives with worked examples and follow-up diagnostic re-tests.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">M</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Medium Topics (50–79%)</h4>
                    <p className="text-xs text-slate-400">Targeted problem solving focusing on nuances, edge cases, and past examination problems.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">S</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Strong Topics (80–100%)</h4>
                    <p className="text-xs text-slate-400">Periodic 15–30 minute spaced retention reviews to prevent cognitive decay without wasting revision hours.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Gap Mockup Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-700/60 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-white">Live Diagnostic Assessment</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Critical Gap Detected
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-400">Topic Under Examination</p>
                    <span className="text-xs font-bold text-rose-400">35% Mastery</span>
                  </div>
                  <p className="text-sm font-semibold text-white">Banker’s Algorithm & Deadlock Avoidance</p>
                  <p className="text-xs text-slate-400 mt-2">
                    &quot;Scored poorly on Safety Algorithm matrix verification and resource request checks. Confused state safety with mutual exclusion.&quot;
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
                  <p className="text-xs font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Source Evidence Citation</span>
                  </p>
                  <p className="text-xs text-slate-300 italic">
                    &quot;Unit 2: Process Synchronization Notes (Page 14): Definition: A state is safe if there exists a safe sequence &lt;P1, P2, ... Pn&gt;...&quot;
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                  <p className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Adaptive Study Prescription</span>
                  </p>
                  <p className="text-xs text-slate-300">
                    Scheduled for Tomorrow at 09:00 AM (60 min Deep-Dive) before taking Retest Quiz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              G
            </div>
            <span className="text-sm font-bold text-white">GapFinder AI</span>
            <span className="text-xs text-slate-500">— Intelligent Learning Diagnosis</span>
          </div>
          <p className="text-xs text-slate-500">
            Founder: Srivignesh
          </p>
        </div>
      </footer>
    </div>
  );
}
