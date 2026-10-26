import { describe, it, expect } from 'vitest';
import { parsePdfBuffer, parsePlainText } from '../lib/rag/parser';
import { chunkDocumentPages } from '../lib/rag/chunking';

// Helper to generate minimal valid PDF with text
function createPdfWithText(text: string): Buffer {
  const streamContent = `BT /F1 16 Tf 50 700 Td (${text}) Tj ET`;
  const streamLen = streamContent.length;

  const pdfContent =
    '%PDF-1.4\n' +
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n' +
    `4 0 obj << /Length ${streamLen} >> stream\n` +
    `${streamContent}\n` +
    'endstream endobj\n' +
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n' +
    'xref\n' +
    '0 6\n' +
    '0000000000 65535 f \n' +
    '0000000009 00000 n \n' +
    '0000000058 00000 n \n' +
    '0000000115 00000 n \n' +
    '0000000244 00000 n \n' +
    `0000000${(300 + streamLen).toString().padStart(3, '0')} 00000 n \n` +
    'trailer << /Size 6 /Root 1 0 R >>\n' +
    'startxref\n' +
    `${400 + streamLen}\n` +
    '%%EOF';

  return Buffer.from(pdfContent);
}

// Helper to simulate multi-file queue addition with deduplication and validation
interface MockFile {
  name: string;
  size: number;
  type: string;
  content: Buffer | string;
}

interface MockQueueItem {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  totalPages?: number;
  totalChunks?: number;
}

function processFileSelection(
  existingQueue: MockQueueItem[],
  incomingFiles: MockFile[]
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

    added.push({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
    });
  }

  return {
    updatedQueue: [...existingQueue, ...added],
    skipped,
  };
}

describe('Multiple File Selection & Batch Processing Workflow', () => {
  it('supports selecting multiple files, appending without replacing, and deduplicating', () => {
    // Initial batch of 2 files
    const batch1: MockFile[] = [
      { name: 'Lecture1_Paging.pdf', size: 1024, type: 'application/pdf', content: '' },
      { name: 'Syllabus.md', size: 512, type: 'text/markdown', content: '' },
    ];

    const step1 = processFileSelection([], batch1);
    expect(step1.updatedQueue.length).toBe(2);
    expect(step1.skipped.length).toBe(0);

    // Second batch appending 1 new file, 1 duplicate, and 1 unsupported file
    const batch2: MockFile[] = [
      { name: 'Lecture2_VirtualMemory.pdf', size: 2048, type: 'application/pdf', content: '' },
      { name: 'Lecture1_Paging.pdf', size: 1024, type: 'application/pdf', content: '' }, // duplicate
      { name: 'Spreadsheet.xlsx', size: 4096, type: 'application/vnd.ms-excel', content: '' }, // unsupported
    ];

    const step2 = processFileSelection(step1.updatedQueue, batch2);
    // Preserved initial 2 + added 1 new = 3 total in queue
    expect(step2.updatedQueue.length).toBe(3);
    expect(step2.skipped).toContain('Lecture1_Paging.pdf (already in list)');
    expect(step2.skipped).toContain('Spreadsheet.xlsx (unsupported format)');
  });

  it('successfully processes a batch of 3 files (2 PDFs + 1 Markdown) through RAG pipeline', async () => {
    const files: MockFile[] = [
      {
        name: 'OS_Chapter1.pdf',
        size: 1500,
        type: 'application/pdf',
        content: createPdfWithText('Process Scheduling and Context Switching in Kernel'),
      },
      {
        name: 'OS_Chapter2.pdf',
        size: 1500,
        type: 'application/pdf',
        content: createPdfWithText('Deadlock Prevention and Banker Algorithm Analysis'),
      },
      {
        name: 'CourseNotes.md',
        size: 300,
        type: 'text/markdown',
        content: '# Unit 3: Virtual Memory\nDemand paging and inverted page tables.',
      },
    ];

    const results = [];

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
      results.push({
        fileName: f.name,
        status: 'completed',
        totalPages,
        totalChunks: chunks.length,
        firstChunk: chunks[0]?.content || '',
      });
    }

    expect(results.length).toBe(3);
    expect(results.every((r) => r.status === 'completed')).toBe(true);
    expect(results[0].firstChunk).toContain('Process Scheduling');
    expect(results[1].firstChunk).toContain('Deadlock Prevention');
    expect(results[2].firstChunk).toContain('Virtual Memory');
  });

  it('handles partial batch failures: valid files succeed even if one file is corrupt or empty', async () => {
    const mixedBatch: MockFile[] = [
      {
        name: 'Valid_Document.pdf',
        size: 1500,
        type: 'application/pdf',
        content: createPdfWithText('Valid Content on Graph Theory and Trees'),
      },
      {
        name: 'Corrupt_Document.pdf',
        size: 100,
        type: 'application/pdf',
        content: Buffer.from('NOT_A_VALID_PDF_STREAM'),
      },
      {
        name: 'Valid_Notes.txt',
        size: 200,
        type: 'text/plain',
        content: 'Graph representation using adjacency matrices.',
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
    expect(batchExecution[0].fileName).toBe('Valid_Document.pdf');

    // File 2: Failed with descriptive error
    expect(batchExecution[1].status).toBe('failed');
    expect(batchExecution[1].errorMessage).toContain('Invalid PDF format');

    // File 3: Succeeded (batch continued after failure!)
    expect(batchExecution[2].status).toBe('completed');
    expect(batchExecution[2].fileName).toBe('Valid_Notes.txt');
  });
});
