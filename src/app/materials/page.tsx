'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Map,
  FileCheck,
  Info,
  Plus,
  X,
  Clock,
  BookOpen,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Document, FileType } from '@/types/database';

export interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
}

export interface QueueItem {
  id: string;
  file: File;
  title: string;
  fileType: FileType;
  subjectId: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  resultSummary?: string;
}

export default function MaterialsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  // Notifications
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Upload Queue State
  const [fileQueue, setFileQueue] = useState<QueueItem[]>([]);
  const [defaultSubjectId, setDefaultSubjectId] = useState<string>('');
  const [defaultFileType, setDefaultFileType] = useState<FileType>('notes');

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/materials');
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
        if (data.subjects) {
          setSubjects(data.subjects);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesSelected = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    setGlobalError(null);
    setGlobalSuccess(null);

    const allowedExtensions = ['.pdf', '.txt', '.md'];
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB

    const newItems: QueueItem[] = [];
    const skippedFiles: string[] = [];

    Array.from(incomingFiles).forEach((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(ext) && file.type !== 'application/pdf' && file.type !== 'text/plain') {
        skippedFiles.push(`${file.name} (unsupported format)`);
        return;
      }

      if (file.size > MAX_SIZE) {
        skippedFiles.push(`${file.name} (exceeds 25MB)`);
        return;
      }

      // Check if file is already in queue (by name and size)
      const isAlreadyInQueue = fileQueue.some(
        (item) => item.file.name === file.name && item.file.size === file.size
      );

      if (isAlreadyInQueue) {
        skippedFiles.push(`${file.name} (already in list)`);
        return;
      }

      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      newItems.push({
        id: uniqueId,
        file,
        title: cleanTitle,
        fileType: defaultFileType,
        subjectId: defaultSubjectId,
        status: 'pending',
      });
    });

    if (newItems.length > 0) {
      setFileQueue((prev) => [...prev, ...newItems]);
    }

    if (skippedFiles.length > 0) {
      setGlobalError(`Skipped ${skippedFiles.length} file(s): ${skippedFiles.join(', ')}`);
    }

    // Reset native input so the user can re-select the same file name if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeQueueItem = (id: string) => {
    if (isUploadingBatch) return;
    setFileQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    if (isUploadingBatch) return;
    setFileQueue([]);
    setGlobalError(null);
    setGlobalSuccess(null);
  };

  const clearCompleted = () => {
    if (isUploadingBatch) return;
    setFileQueue((prev) => prev.filter((item) => item.status !== 'completed'));
  };

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setFileQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const uploadBatch = async () => {
    const pendingItems = fileQueue.filter((item) => item.status === 'pending' || item.status === 'failed');
    if (pendingItems.length === 0) {
      setGlobalError('No pending files to upload.');
      return;
    }

    setIsUploadingBatch(true);
    setGlobalError(null);
    setGlobalSuccess(null);

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      // 1. Mark uploading
      updateQueueItem(item.id, { status: 'uploading', errorMessage: undefined });

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('title', item.title || item.file.name.replace(/\.[^/.]+$/, ''));
        formData.append('file_type', item.fileType);
        if (item.subjectId) {
          formData.append('subject_id', item.subjectId);
        }

        // Switch status to processing (RAG chunking + embedding in progress)
        updateQueueItem(item.id, { status: 'processing' });

        const res = await fetch('/api/materials/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          failCount++;
          updateQueueItem(item.id, {
            status: 'failed',
            errorMessage: data.error || 'Failed to upload or parse document.',
          });
        } else {
          successCount++;
          updateQueueItem(item.id, {
            status: 'completed',
            resultSummary: `${data.totalPages} page${data.totalPages !== 1 ? 's' : ''} • ${data.totalChunks} chunks`,
          });
        }
      } catch (err: any) {
        failCount++;
        updateQueueItem(item.id, {
          status: 'failed',
          errorMessage: err.message || 'Network connection error during upload.',
        });
      }
    }

    setIsUploadingBatch(false);
    await fetchDocuments();

    if (failCount === 0 && successCount > 0) {
      setGlobalSuccess(`Successfully uploaded and indexed all ${successCount} document(s)!`);
    } else if (successCount > 0 && failCount > 0) {
      setGlobalSuccess(`Batch completed: ${successCount} processed successfully, ${failCount} failed.`);
      setGlobalError(`Please inspect the failed items in the queue above.`);
    } else if (failCount > 0) {
      setGlobalError(`All ${failCount} document upload(s) failed. Please review the errors.`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" and all its vector chunks?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/materials?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleExtractSyllabus = async (docId: string) => {
    setExtractingId(docId);
    setGlobalError(null);
    setGlobalSuccess(null);

    try {
      const res = await fetch('/api/topics/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setGlobalError(data.error || 'Failed to extract topics from syllabus.');
      } else {
        setGlobalSuccess(`Extracted ${data.totalTopicsExtracted} curriculum topics! Redirecting to Topic Map...`);
        setTimeout(() => {
          router.push('/topics');
        }, 1500);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Extraction error');
    } finally {
      setExtractingId(null);
    }
  };

  const pendingCount = fileQueue.filter((i) => i.status === 'pending' || i.status === 'failed').length;
  const completedCount = fileQueue.filter((i) => i.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Study Materials & Document Index</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                Batch RAG Ingestion
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select and upload multiple syllabus, lecture notes, textbook chapters, or exam papers. Chunks preserve page numbers and are embedded for retrieval.
            </p>
          </div>
        </div>

        {/* Global Alerts */}
        {globalError && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {globalSuccess && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{globalSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* Upload Queue Section (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-indigo-400" />
                  <span>Batch File Selection</span>
                </h3>
                {fileQueue.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {fileQueue.length} {fileQueue.length === 1 ? 'file' : 'files'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Support for multiple PDF, TXT, and Markdown files (up to 25MB each).
              </p>

              {/* Default Settings for added files */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Default Category
                  </label>
                  <select
                    value={defaultFileType}
                    onChange={(e) => setDefaultFileType(e.target.value as FileType)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="notes">Lecture Notes</option>
                    <option value="syllabus">Syllabus</option>
                    <option value="textbook">Textbook Chapter</option>
                    <option value="exam_paper">Exam Paper</option>
                    <option value="other">Other Reference</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Associate Subject/Course
                  </label>
                  <select
                    value={defaultSubjectId}
                    onChange={(e) => setDefaultSubjectId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">General / No Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multiple File Picker Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-xl p-5 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/70 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 transition-colors">
                    <Plus className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-white">
                    Click to select multiple files or drag them here
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    PDF, TXT, or MD • Hold Ctrl/Cmd to select multiple
                  </p>
                </div>
              </div>

              {/* Selected Files List in Queue */}
              {fileQueue.length > 0 && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                    <span className="font-semibold text-slate-300">
                      Files to Ingest ({fileQueue.length})
                    </span>
                    <div className="flex items-center gap-2">
                      {completedCount > 0 && (
                        <button
                          type="button"
                          onClick={clearCompleted}
                          disabled={isUploadingBatch}
                          className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                        >
                          Clear Completed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearQueue}
                        disabled={isUploadingBatch}
                        className="text-[11px] text-rose-400 hover:text-rose-300 disabled:opacity-40"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {fileQueue.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div className="truncate">
                              <p className="font-medium text-slate-200 truncate">{item.file.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {formatFileSize(item.file.size)} • {item.file.name.split('.').pop()?.toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Status Badges */}
                            {item.status === 'pending' && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Pending</span>
                              </span>
                            )}
                            {item.status === 'uploading' && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                <span>Uploading</span>
                              </span>
                            )}
                            {item.status === 'processing' && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                <span>Chunking & Embedding</span>
                              </span>
                            )}
                            {item.status === 'completed' && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Completed</span>
                              </span>
                            )}
                            {item.status === 'failed' && (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>Failed</span>
                              </span>
                            )}

                            {/* Remove button */}
                            {item.status !== 'uploading' && item.status !== 'processing' && (
                              <button
                                type="button"
                                onClick={() => removeQueueItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                title="Remove file from queue"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Editable file details before upload */}
                        {item.status === 'pending' && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                            <div>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateQueueItem(item.id, { title: e.target.value })}
                                placeholder="Custom Title"
                                className="w-full bg-slate-950 border border-slate-800 text-[11px] rounded-lg px-2 py-1 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <select
                                value={item.fileType}
                                onChange={(e) =>
                                  updateQueueItem(item.id, { fileType: e.target.value as FileType })
                                }
                                className="w-full bg-slate-950 border border-slate-800 text-[11px] rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="notes">Notes</option>
                                <option value="syllabus">Syllabus</option>
                                <option value="textbook">Textbook</option>
                                <option value="exam_paper">Exam Paper</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Completed Summary */}
                        {item.resultSummary && (
                          <p className="text-[10px] text-emerald-400/90 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/15">
                            {item.resultSummary}
                          </p>
                        )}

                        {/* Error Message */}
                        {item.errorMessage && (
                          <p className="text-[10px] text-rose-400 bg-rose-500/10 p-1.5 rounded border border-rose-500/20 leading-relaxed">
                            {item.errorMessage}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Batch Upload Actions */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={uploadBatch}
                      disabled={isUploadingBatch || pendingCount === 0}
                      className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                    >
                      {isUploadingBatch ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing Batch...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>
                            {pendingCount > 0 ? `Upload All (${pendingCount} pending)` : 'All Uploaded'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Notice Box */}
              <div className="mt-5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Server-Side RAG Processing</span>
                </div>
                <p>
                  Documents are parsed on the server without browser DOM dependencies. Page numbers are preserved for precise quiz grounding.
                </p>
              </div>
            </div>
          </div>

          {/* Library Section (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Indexed Course Library ({documents.length})</span>
              </span>
              <button
                onClick={fetchDocuments}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Library</span>
              </button>
            </h3>

            {loading ? (
              <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-600" />
                <span>Loading library...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">No documents uploaded yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Select and upload your syllabus, notes, or textbook chapters to build your diagnostic gap map.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                            {doc.title}
                          </h4>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {doc.file_type}
                          </span>
                          {(doc as any).subjects?.name && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              {(doc as any).subjects.name}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              doc.processing_status === 'ready'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : doc.processing_status === 'error'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {doc.processing_status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>{doc.file_name}</span>
                          <span>•</span>
                          <span>{doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            {doc.total_chunks} vector chunks
                          </span>
                          {doc.file_size && (
                            <>
                              <span>•</span>
                              <span>{formatFileSize(doc.file_size)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>

                        {doc.error_message && (
                          <p className="text-[11px] text-rose-400 mt-2 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                            {doc.error_message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {doc.file_type === 'syllabus' && doc.processing_status === 'ready' && (
                        <button
                          onClick={() => handleExtractSyllabus(doc.id)}
                          disabled={extractingId === doc.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Map className="w-3.5 h-3.5" />
                          <span>{extractingId === doc.id ? 'Extracting...' : 'Extract Topics'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
