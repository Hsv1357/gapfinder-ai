'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  MessageSquare, 
  Send, 
  BookOpen, 
  AlertCircle, 
  RefreshCw
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Citation } from '@/types/database';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  hasSufficientEvidence?: boolean;
  isError?: boolean;
  retryQuery?: string;
}

function ExplainContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic');

  const [query, setQuery] = useState(initialTopic || '');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);

  // Load weak topics for quick prompt pills
  useEffect(() => {
    fetch('/api/gaps')
      .then((r) => r.json())
      .then((data) => {
        if (data.categories?.weak) {
          const titles = data.categories.weak.map((w: any) => w.topic_title).filter(Boolean);
          setWeakTopics(titles);
        }
      })
      .catch((e) => console.error(e));
  }, []);

  // If initial topic in URL, auto-ask
  useEffect(() => {
    if (initialTopic) {
      handleAsk(initialTopic);
    }
  }, [initialTopic]);

  const handleAsk = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: data.error || 'Failed to generate explanation. The AI service may be temporarily unavailable.',
          isError: true,
          retryQuery: trimmed,
          citations: [],
          hasSufficientEvidence: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'No response generated.',
        citations: data.citations || [],
        hasSufficientEvidence: data.hasSufficientEvidence ?? true,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: `Service request error: ${err.message}`,
          isError: true,
          retryQuery: trimmed,
          hasSufficientEvidence: true,
          citations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20 flex flex-col justify-between">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex-1 flex flex-col">
        {/* Header */}
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Explain-This-Topic Assistant</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
              Grounded RAG
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Student companion grounded strictly in your uploaded course materials. Refuses to invent facts or citations.
          </p>
        </div>

        {/* Quick weak topic pills */}
        {weakTopics.length > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 text-xs">
            <span className="text-slate-500 shrink-0 font-medium">Diagnosed Gaps:</span>
            {weakTopics.map((title, i) => (
              <button
                key={i}
                onClick={() => handleAsk(`Explain ${title} and how it works`)}
                className="px-3 py-1 rounded-full bg-slate-900 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500 transition-colors shrink-0"
              >
                Explain {title}
              </button>
            ))}
          </div>
        )}

        {/* Chat Stream */}
        <div className="flex-1 py-6 space-y-6 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="py-16 text-center glass-panel rounded-2xl border border-slate-800 p-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Ask anything from your uploaded materials</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Ask conceptual questions, request worked examples, or clarify difficult algorithms. Every response is verified against indexed passages.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'glass-panel border border-slate-800 text-slate-200 rounded-tl-none space-y-3'
                    }`}
                  >
                    {!isUser && msg.isError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{msg.text}</span>
                        </div>
                        {msg.retryQuery && (
                          <button
                            onClick={() => handleAsk(msg.retryQuery!)}
                            disabled={loading}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold shrink-0 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    )}

                    {!isUser && !msg.isError && !msg.hasSufficientEvidence && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Uploaded materials lack complete evidence for this specific query.</span>
                      </div>
                    )}

                    {!msg.isError && <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>}

                    {!isUser && !msg.isError && msg.citations && msg.citations.length > 0 && (
                      <div className="pt-3 border-t border-slate-800 space-y-2">
                        <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Supporting Source Citations ({msg.citations.length})</span>
                        </p>
                        <div className="space-y-1.5">
                          {msg.citations.map((c, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                <span className="font-semibold text-slate-300">{c.document_title}</span>
                                <span>{c.page_number ? `Page ${c.page_number}` : 'Reference'}</span>
                              </div>
                              <p className="text-slate-400 italic text-[11px]">&quot;{c.passage}&quot;</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="glass-panel border border-slate-800 rounded-2xl rounded-tl-none p-4 flex items-center gap-3 text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Searching pgvector index and formulating verified explanation...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-4 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your uploaded materials..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="py-3 px-5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span>Ask</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function ExplainPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16]" />}>
      <ExplainContent />
    </Suspense>
  );
}
