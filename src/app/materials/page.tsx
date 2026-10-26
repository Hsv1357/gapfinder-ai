'use client';

import { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Document, FileType } from '@/types/database';

export default function MaterialsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('notes');

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/materials');
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!customTitle) {
        setCustomTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', customTitle);
    formData.append('file_type', fileType);

    try {
      const res = await fetch('/api/materials/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Upload and processing failed.');
      } else {
        setSuccessMsg(`"${data.title}" successfully processed into ${data.totalChunks} grounded chunks.`);
        setFile(null);
        setCustomTitle('');
        await fetchDocuments();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" and all its vector chunks?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/materials?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleExtractSyllabus = async (docId: string) => {
    setExtractingId(docId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/topics/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to extract topics from syllabus.');
      } else {
        setSuccessMsg(`Extracted ${data.totalTopicsExtracted} curriculum topics! Redirecting to Topic Map...`);
        setTimeout(() => {
          router.push('/topics');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Extraction error');
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Study Materials & Document Index</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                RAG Ingestion
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Upload your syllabus, lecture notes, textbooks, and past examination papers for chunking and vector indexing.
            </p>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
          {/* Upload Form Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 h-fit">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <span>Upload New Material</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              PDF, TXT, or Markdown (up to 25MB). Chunks preserve page numbers.
            </p>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Document Type
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value as FileType)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="syllabus">Syllabus (Extracts Topic Hierarchy)</option>
                  <option value="notes">Lecture Notes</option>
                  <option value="textbook">Textbook Chapter</option>
                  <option value="exam_paper">Previous Examination Paper</option>
                  <option value="other">Other Reference Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Custom Title (Optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Unit 3 Virtual Memory Notes"
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  File Upload
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-900/40 relative">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <FileText className="w-8 h-8 text-indigo-400 mb-2" />
                    <p className="text-xs font-medium text-slate-300">
                      {file ? file.name : 'Choose a file or drag here'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF, TXT, or MD'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Processing Guarantee</span>
                </div>
                <p>
                  Text is extracted page-by-page. If a scanned PDF contains no text layer, you will be notified immediately to run OCR.
                </p>
              </div>

              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Chunking & Indexing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Index Document</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Document List (2 Columns on large screens) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center justify-between">
              <span>Indexed Course Library ({documents.length})</span>
              <button
                onClick={fetchDocuments}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </h3>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">No documents uploaded yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Upload your syllabus or lecture slides to enable diagnostic testing and automated gap analysis.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-white">{doc.title}</h4>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {doc.file_type}
                          </span>
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

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span>{doc.total_pages} pages</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            {doc.total_chunks} vector chunks
                          </span>
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

                    <div className="flex items-center gap-2 self-end sm:self-center">
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
