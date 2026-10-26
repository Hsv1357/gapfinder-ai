import { describe, it, expect } from 'vitest';
import { parsePdfBuffer, parsePlainText } from '../lib/rag/parser';
import { chunkDocumentPages } from '../lib/rag/chunking';
import { FileType } from '../types/database';

// Helper to generate a multi-page valid PDF with distinct page streams
function createMultiPagePdf(pagesText: string[]): Buffer {
  let pdf = '%PDF-1.4\n';
  const objOffsets: number[] = [];

  objOffsets[1] = pdf.length;
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  const count = pagesText.length;
  const kidsStr = pagesText.map((_, i) => `${3 + i * 2} 0 R`).join(' ');

  objOffsets[2] = pdf.length;
  pdf += `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${count} >>\nendobj\n`;

  const fontObjNum = 3 + count * 2;

  pagesText.forEach((text, i) => {
    const pageObjNum = 3 + i * 2;
    const contentObjNum = 4 + i * 2;
    const streamContent = `BT /F1 12 Tf 50 700 Td (${text.replace(/[()]/g, '')}) Tj ET`;

    objOffsets[pageObjNum] = pdf.length;
    pdf += `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`;

    objOffsets[contentObjNum] = pdf.length;
    pdf += `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  });

  objOffsets[fontObjNum] = pdf.length;
  pdf += `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  const startXref = pdf.length;
  pdf += `xref\n0 ${fontObjNum + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= fontObjNum; i++) {
    const offset = (objOffsets[i] || 0).toString().padStart(10, '0');
    pdf += `${offset} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${fontObjNum + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return Buffer.from(pdf);
}

interface MockFile {
  name: string;
  size: number;
  type: string;
  content: Buffer | string;
  category?: FileType;
  subjectId?: string;
  title?: string;
}

interface MockQueueItem {
  id: string;
  name: string;
  size: number;
  type: string;
  category: FileType;
  subjectId: string;
  title: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  totalPages?: number;
  totalChunks?: number;
}

function processFileSelection(
  existingQueue: MockQueueItem[],
  incomingFiles: MockFile[],
  defaultSubjectId = '',
  defaultCategory: FileType = 'notes'
): { updatedQueue: MockQueueItem[]; skipped: string[] } {
  const allowedExtensions = ['.pdf', '.txt', '.md'];
  const MAX_SIZE = 25 * 1024 * 1024;
  const skipped: string[] = [];
  const added: MockQueueItem[] = [];

  for (const file of incomingFiles) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      skipped.push(`${file.name} (unsupported format)`);
      continue;
    }

    if (file.size > MAX_SIZE) {
      skipped.push(`${file.name} (exceeds 25MB)`);
      continue;
    }

    const isDuplicate = existingQueue.concat(added).some(
      (item) => item.name === file.name && item.size === file.size
    );

    if (isDuplicate) {
      skipped.push(`${file.name} (already in list)`);
      continue;
    }

    let category = file.category || defaultCategory;
    const lower = file.name.toLowerCase();
    if (lower.includes('syllabus')) category = 'syllabus';
    else if (lower.includes('exam') || lower.includes('paper')) category = 'exam_paper';

    added.push({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      category,
      subjectId: file.subjectId || defaultSubjectId,
      title: file.title || file.name.replace(/\.[^/.]+$/, ''),
      status: 'pending',
    });
  }

  return {
    updatedQueue: [...existingQueue, ...added],
    skipped,
  };
}

describe('Multiple File Selection, Subject Assignment & Batch Processing Workflow', () => {
  it('supports selecting multiple files, appending without replacing, and deduplicating', () => {
    const batch1: MockFile[] = [
      { name: 'ids syllabus.pdf', size: 2048, type: 'application/pdf', content: '' },
      { name: 'lecture1_notes.txt', size: 512, type: 'text/plain', content: '' },
    ];

    const step1 = processFileSelection([], batch1, 'subj-os-101', 'notes');
    expect(step1.updatedQueue.length).toBe(2);
    expect(step1.skipped.length).toBe(0);
    expect(step1.updatedQueue[0].category).toBe('syllabus'); // auto-inferred
    expect(step1.updatedQueue[0].subjectId).toBe('subj-os-101');

    // Second batch appending 1 new file, 1 duplicate, and 1 unsupported file
    const batch2: MockFile[] = [
      { name: 'chapter3_virtual_memory.md', size: 1024, type: 'text/markdown', content: '' },
      { name: 'ids syllabus.pdf', size: 2048, type: 'application/pdf', content: '' }, // duplicate
      { name: 'archive.zip', size: 5000, type: 'application/zip', content: '' }, // unsupported
    ];

    const step2 = processFileSelection(step1.updatedQueue, batch2, 'subj-os-101', 'textbook');
    expect(step2.updatedQueue.length).toBe(3);
    expect(step2.skipped).toContain('ids syllabus.pdf (already in list)');
    expect(step2.skipped).toContain('archive.zip (unsupported format)');
  });

  it('successfully processes a real batch of 3 files (Multi-page PDF syllabus + PDF Notes + Markdown textbook)', async () => {
    const files: MockFile[] = [
      {
        name: 'ids syllabus.pdf',
        size: 3000,
        type: 'application/pdf',
        category: 'syllabus',
        subjectId: 'subj-ids-01',
        title: 'Information & Database Systems Syllabus',
        content: createMultiPagePdf([
          'Unit 1: Relational Algebra, SQL, Integrity Constraints, and Functional Dependencies.',
          'Unit 2: Normal Forms, BCNF Decomposition, and Concurrency Control.',
        ]),
      },
      {
        name: 'lecture_transactions.pdf',
        size: 1500,
        type: 'application/pdf',
        category: 'notes',
        subjectId: 'subj-ids-01',
        title: 'Transactions & ACID Properties',
        content: createMultiPagePdf([
          'ACID properties: Atomicity, Consistency, Isolation, and Durability in distributed databases.',
        ]),
      },
      {
        name: 'indexing_chapter.md',
        size: 800,
        type: 'text/markdown',
        category: 'textbook',
        subjectId: 'subj-ids-01',
        title: 'B-Trees and Hash Indexing',
        content: '# Indexing Strategies\nB+ Trees provide efficient range queries and logarithmic search complexity.',
      },
    ];

    const batchResults = [];

    for (const f of files) {
      let pages = [];
      let totalPages = 1;

      if (f.name.endsWith('.pdf')) {
        const parsed = await parsePdfBuffer(f.content as Buffer);
        pages = parsed.pages;
        totalPages = parsed.totalPages;
      } else {
        pages = parsePlainText(f.content as string);
        totalPages = pages.length;
      }

      const chunks = chunkDocumentPages(pages, { maxChunkSize: 1000, overlap: 100 });

      // Build simulated grounded vector chunk records with source citations
      const chunkRecords = chunks.map((c) => ({
        subject_id: f.subjectId,
        document_title: f.title,
        file_type: f.category,
        page_number: c.pageNumber,
        chunk_index: c.chunkIndex,
        content: c.content,
      }));

      batchResults.push({
        fileName: f.name,
        category: f.category,
        subjectId: f.subjectId,
        status: 'completed' as const,
        totalPages,
        totalChunks: chunks.length,
        chunks: chunkRecords,
      });
    }

    expect(batchResults.length).toBe(3);
    expect(batchResults.every((r) => r.status === 'completed')).toBe(true);

    // Verify Document 1: ids syllabus.pdf
    expect(batchResults[0].totalPages).toBe(2);
    expect(batchResults[0].category).toBe('syllabus');
    expect(batchResults[0].chunks[0].content).toContain('Relational Algebra');
    expect(batchResults[0].chunks[0].page_number).toBe(1);
    expect(batchResults[0].chunks[1].page_number).toBe(2);

    // Verify Document 2: lecture_transactions.pdf
    expect(batchResults[1].category).toBe('notes');
    expect(batchResults[1].chunks[0].content).toContain('ACID properties');

    // Verify Document 3: indexing_chapter.md
    expect(batchResults[2].category).toBe('textbook');
    expect(batchResults[2].chunks[0].content).toContain('B+ Trees');
  });

  it('handles partial batch failures: valid files succeed even if one file is corrupt or empty', async () => {
    const mixedBatch: MockFile[] = [
      {
        name: 'ids syllabus.pdf',
        size: 2000,
        type: 'application/pdf',
        content: createMultiPagePdf(['Valid Syllabus for Operating Systems: CPU Scheduling & Deadlocks']),
      },
      {
        name: 'corrupted_file.pdf',
        size: 50,
        type: 'application/pdf',
        content: Buffer.from('CORRUPT_NOT_A_PDF_STREAM'),
      },
      {
        name: 'revision_notes.txt',
        size: 300,
        type: 'text/plain',
        content: 'Banker algorithm for deadlock avoidance in multi-threaded OS.',
      },
    ];

    const batchExecution = [];

    for (const f of mixedBatch) {
      try {
        let pages = [];
        let totalPages = 1;

        if (f.name.endsWith('.pdf')) {
          const parsed = await parsePdfBuffer(f.content as Buffer);
          pages = parsed.pages;
          totalPages = parsed.totalPages;
        } else {
          pages = parsePlainText(f.content as string);
          totalPages = pages.length;
        }

        const chunks = chunkDocumentPages(pages);
        batchExecution.push({
          fileName: f.name,
          status: 'completed' as const,
          totalPages,
          chunksCount: chunks.length,
        });
      } catch (err: any) {
        batchExecution.push({
          fileName: f.name,
          status: 'failed' as const,
          errorMessage: err.message,
        });
      }
    }

    expect(batchExecution.length).toBe(3);

    // File 1: Succeeded
    expect(batchExecution[0].status).toBe('completed');
    expect(batchExecution[0].fileName).toBe('ids syllabus.pdf');

    // File 2: Failed with descriptive error
    expect(batchExecution[1].status).toBe('failed');
    expect(batchExecution[1].errorMessage).toContain('Invalid PDF format');

    // File 3: Succeeded (batch continued after failure!)
    expect(batchExecution[2].status).toBe('completed');
    expect(batchExecution[2].fileName).toBe('revision_notes.txt');
  });
});
