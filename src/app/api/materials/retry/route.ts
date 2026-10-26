import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { parsePdfBuffer, parsePlainText } from '@/lib/rag/parser';
import { chunkDocumentPages } from '@/lib/rag/chunking';
import { generateEmbeddingsBatch } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter.' }, { status: 400 });
    }

    // Fetch document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    if (!doc.storage_path) {
      return NextResponse.json({
        error: 'Document file buffer is not available in storage. Please re-upload the document.',
      }, { status: 400 });
    }

    // Set status to processing
    await supabase
      .from('documents')
      .update({ processing_status: 'processing', error_message: null })
      .eq('id', documentId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('study-materials')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: `Storage download failed: ${downloadError?.message || 'File not found'}`,
        })
        .eq('id', documentId);
      return NextResponse.json({ error: 'Failed to retrieve file from storage.' }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = doc.file_name.toLowerCase();

    let pages = [];
    let totalPages = 1;

    try {
      if (fileName.endsWith('.pdf')) {
        const parsed = await parsePdfBuffer(buffer);
        pages = parsed.pages;
        totalPages = parsed.totalPages;
      } else {
        const text = buffer.toString('utf-8');
        pages = parsePlainText(text);
        totalPages = pages.length;
      }
    } catch (parseErr: any) {
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: `Extraction error: ${parseErr.message}`,
        })
        .eq('id', documentId);
      return NextResponse.json({ error: parseErr.message }, { status: 422 });
    }

    if (pages.length === 0 || pages.every((p) => !p.text.trim())) {
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: 'Document contains no extractable text.',
        })
        .eq('id', documentId);
      return NextResponse.json({ error: 'No extractable text found.' }, { status: 422 });
    }

    const chunks = chunkDocumentPages(pages, { maxChunkSize: 1000, overlap: 150 });
    const chunkContents = chunks.map((c) => c.content);

    let embeddings: (number[] | null)[] = [];
    try {
      embeddings = await generateEmbeddingsBatch(chunkContents, 5);
    } catch (batchErr) {
      console.warn('Retry batch embedding error:', batchErr);
      embeddings = chunks.map(() => null);
    }

    // Clean up any previously stored chunks
    await supabase.from('document_chunks').delete().eq('document_id', documentId);

    const chunkRecords = chunks.map((c, i) => ({
      document_id: documentId,
      user_id: user.id,
      subject_id: doc.subject_id,
      chunk_index: c.chunkIndex,
      page_number: c.pageNumber,
      section_title: c.sectionTitle,
      content: c.content,
      token_count: c.tokenCount,
      embedding: embeddings[i] || null,
    }));

    const { error: chunkInsertError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (chunkInsertError) {
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: `Database storage error: ${chunkInsertError.message}`,
        })
        .eq('id', documentId);
      return NextResponse.json({ error: chunkInsertError.message }, { status: 500 });
    }

    await supabase
      .from('documents')
      .update({
        processing_status: 'ready',
        error_message: null,
        total_pages: totalPages,
        total_chunks: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    return NextResponse.json({
      success: true,
      documentId,
      totalPages,
      totalChunks: chunks.length,
    });
  } catch (err: any) {
    console.error('Retry extraction error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
