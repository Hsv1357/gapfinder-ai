import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { parsePdfBuffer, parsePlainText } from '@/lib/rag/parser';
import { chunkDocumentPages } from '@/lib/rag/chunking';
import { generateEmbeddingsBatch } from '@/lib/gemini';
import { FileType } from '@/types/database';

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const subjectId = formData.get('subject_id') as string | null;
    const cleanSubjectId = subjectId && subjectId.trim() !== '' && subjectId !== 'none' ? subjectId.trim() : null;
    const fileType = (formData.get('file_type') as FileType) || 'notes';
    const customTitle = formData.get('title') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isTxt = lowerName.endsWith('.txt') || file.type === 'text/plain';
    const isMd = lowerName.endsWith('.md') || file.type === 'text/markdown';

    if (!isPdf && !isTxt && !isMd) {
      return NextResponse.json({
        error: `Unsupported file type for "${fileName}". Only PDF (.pdf), Plain Text (.txt), and Markdown (.md) documents are supported.`,
      }, { status: 400 });
    }

    // File size limit: 25MB
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File "${fileName}" exceeds maximum 25MB limit.` }, { status: 400 });
    }

    const docTitle = customTitle?.trim() || fileName.replace(/\.[^/.]+$/, '');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optional upload to Supabase Storage ('study-materials' bucket)
    let storagePath: string | null = null;
    try {
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageKey = `${user.id}/${Date.now()}_${sanitizedName}`;
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('study-materials')
        .upload(storageKey, buffer, {
          contentType: file.type || (isPdf ? 'application/pdf' : 'text/plain'),
          upsert: true,
        });

      if (!storageErr && storageData) {
        storagePath = storageData.path;
      } else if (storageErr) {
        console.warn('Supabase storage upload notice:', storageErr.message);
      }
    } catch (stErr) {
      console.warn('Supabase storage upload exception:', stErr);
    }

    // Check if an existing document with identical file_name exists for user & subject to prevent duplicate document spam
    let documentId: string;
    let existingDocQuery = supabase
      .from('documents')
      .select('id')
      .eq('user_id', user.id)
      .eq('file_name', fileName);

    if (cleanSubjectId) {
      existingDocQuery = existingDocQuery.eq('subject_id', cleanSubjectId);
    }

    const { data: existingDocs } = await existingDocQuery.limit(1);

    if (existingDocs && existingDocs.length > 0) {
      documentId = existingDocs[0].id;
      // Clean up previous chunks before re-processing to prevent duplicate chunks
      await supabase.from('document_chunks').delete().eq('document_id', documentId);
      await supabase
        .from('documents')
        .update({
          title: docTitle,
          file_type: fileType,
          file_size: file.size,
          storage_path: storagePath || undefined,
          processing_status: 'processing',
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);
    } else {
      // 1. Initial insert into documents table
      const { data: docRecord, error: docInsertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          subject_id: cleanSubjectId,
          title: docTitle,
          file_name: fileName,
          file_type: fileType,
          file_size: file.size,
          storage_path: storagePath,
          processing_status: 'processing',
        })
        .select()
        .single();

      if (docInsertError || !docRecord) {
        console.error('Document insert error:', docInsertError);
        return NextResponse.json({ error: 'Failed to create document record.' }, { status: 500 });
      }
      documentId = docRecord.id;
    }

    // 2. Parse document text
    let pages = [];
    let totalPages = 1;

    try {
      if (fileName.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
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
          error_message: `Extraction error: ${parseErr.message}. If this is a scanned PDF image, OCR is required.`,
        })
        .eq('id', documentId);

      return NextResponse.json({
        error: `Failed to extract text from document: ${parseErr.message}`,
      }, { status: 422 });
    }

    if (pages.length === 0 || pages.every((p) => !p.text.trim())) {
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: 'Document contains no extractable text. Scanned document requires OCR.',
        })
        .eq('id', documentId);

      return NextResponse.json({
        error: 'The document is empty or contains non-selectable scanned images without text layers.',
      }, { status: 422 });
    }

    // 3. Chunk the pages
    const chunks = chunkDocumentPages(pages, { maxChunkSize: 1000, overlap: 150 });

    // 4. Generate embeddings in parallel batches (concurrency: 5)
    const chunkContents = chunks.map((c) => c.content);
    let embeddings: (number[] | null)[] = [];
    try {
      embeddings = await generateEmbeddingsBatch(chunkContents, 5);
    } catch (batchErr) {
      console.warn('Batch embedding generation error, saving chunks with null vectors:', batchErr);
      embeddings = chunks.map(() => null);
    }

    const chunkRecords = chunks.map((c, i) => ({
      document_id: documentId,
      user_id: user.id,
      subject_id: cleanSubjectId,
      chunk_index: c.chunkIndex,
      page_number: c.pageNumber,
      section_title: c.sectionTitle,
      content: c.content,
      token_count: c.tokenCount,
      embedding: embeddings[i] || null,
    }));

    // 5. Bulk insert chunks
    const { error: chunkInsertError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (chunkInsertError) {
      console.error('Chunks insert error:', chunkInsertError);
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: `Database storage error: ${chunkInsertError.message}`,
        })
        .eq('id', documentId);

      return NextResponse.json({ error: 'Failed to store document chunks in database.' }, { status: 500 });
    }

    // 6. Mark document as ready
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
      title: docTitle,
      totalPages,
      totalChunks: chunks.length,
    });
  } catch (error: any) {
    console.error('Upload handling error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
