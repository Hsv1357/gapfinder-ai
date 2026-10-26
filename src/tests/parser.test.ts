import { describe, it, expect } from 'vitest';
import { parsePdfBuffer, parsePlainText } from '../lib/rag/parser';

describe('PDF and Text Parser', () => {
  // Helper to generate a minimal valid PDF with text
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

  // Helper to generate an image-only / empty text PDF
  function createScannedPdf(): Buffer {
    const pdfContent =
      '%PDF-1.4\n' +
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> >> endobj\n' +
      'xref\n' +
      '0 4\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000058 00000 n \n' +
      '0000000115 00000 n \n' +
      'trailer << /Size 4 /Root 1 0 R >>\n' +
      'startxref\n' +
      '190\n' +
      '%%EOF';

    return Buffer.from(pdfContent);
  }

  it('correctly extracts page text from valid PDF without DOMMatrix errors', async () => {
    const buffer = createPdfWithText('Memory Allocation Strategies in Modern OS');
    const result = await parsePdfBuffer(buffer);

    expect(result.totalPages).toBe(1);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Memory Allocation Strategies');
  });

  it('identifies scanned/image-only PDFs and requests OCR', async () => {
    const buffer = createScannedPdf();
    await expect(parsePdfBuffer(buffer)).rejects.toThrow(/scanned image or contains no selectable text layer/);
  });

  it('rejects empty 0-byte buffer', async () => {
    await expect(parsePdfBuffer(Buffer.alloc(0))).rejects.toThrow(/Empty file/);
  });

  it('rejects corrupt non-PDF buffer', async () => {
    const corruptBuffer = Buffer.from('This is a corrupt file with no pdf header');
    await expect(parsePdfBuffer(corruptBuffer)).rejects.toThrow(/Invalid PDF format/);
  });

  it('parses plain text and markdown with page approximation', () => {
    const sampleText = 'Introduction to Operating Systems\n\nChapter 1 covers processes.';
    const pages = parsePlainText(sampleText);
    expect(pages.length).toBe(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].text).toBe(sampleText);
  });
});
