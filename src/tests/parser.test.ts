import { describe, it, expect } from 'vitest';
import { parsePdfBuffer, parsePlainText } from '../lib/rag/parser';

describe('PDF and Text Parser with unpdf', () => {
  // Helper to generate a multi-page valid PDF with distinct page streams
  function createMultiPagePdf(pagesText: string[]): Buffer {
    let pdf = '%PDF-1.4\n';
    const objOffsets: number[] = [];

    // Catalog (1 0 obj)
    objOffsets[1] = pdf.length;
    pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

    // Page count
    const count = pagesText.length;
    const kidsStr = pagesText.map((_, i) => `${3 + i * 2} 0 R`).join(' ');

    // Pages parent (2 0 obj)
    objOffsets[2] = pdf.length;
    pdf += `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${count} >>\nendobj\n`;

    const fontObjNum = 3 + count * 2;

    // Generate Page and Content stream objects for each page
    pagesText.forEach((text, i) => {
      const pageObjNum = 3 + i * 2;
      const contentObjNum = 4 + i * 2;
      const streamContent = `BT /F1 12 Tf 50 700 Td (${text.replace(/[()]/g, '')}) Tj ET`;

      // Page object
      objOffsets[pageObjNum] = pdf.length;
      pdf += `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`;

      // Content stream object
      objOffsets[contentObjNum] = pdf.length;
      pdf += `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
    });

    // Font object
    objOffsets[fontObjNum] = pdf.length;
    pdf += `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

    // Cross-reference table
    const startXref = pdf.length;
    pdf += `xref\n0 ${fontObjNum + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= fontObjNum; i++) {
      const offset = (objOffsets[i] || 0).toString().padStart(10, '0');
      pdf += `${offset} 00000 n \n`;
    }

    // Trailer
    pdf += `trailer\n<< /Size ${fontObjNum + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

    return Buffer.from(pdf);
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

  it('correctly parses real multi-page syllabus PDF without DOMMatrix or worker errors', async () => {
    const syllabusPages = [
      'Course: IDS Syllabus - Information and Database Systems. Unit 1: Relational Data Model and SQL Queries.',
      'Unit 2: Normalization (1NF, 2NF, 3NF, BCNF) and Transaction Processing.',
      'Unit 3: Indexing, B-Trees, and Query Optimization Strategies.',
    ];

    const buffer = createMultiPagePdf(syllabusPages);
    const result = await parsePdfBuffer(buffer);

    expect(result.totalPages).toBe(3);
    expect(result.pages.length).toBe(3);

    // Verify page numbers are preserved
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Information and Database Systems');

    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain('Normalization');

    expect(result.pages[2].pageNumber).toBe(3);
    expect(result.pages[2].text).toContain('Query Optimization');
  });

  it('correctly parses single-page lecture notes PDF', async () => {
    const buffer = createMultiPagePdf(['Memory Allocation Strategies: Paging, Segmentation, and Inverted Page Tables.']);
    const result = await parsePdfBuffer(buffer);

    expect(result.totalPages).toBe(1);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Memory Allocation Strategies');
  });

  it('identifies scanned/image-only PDFs and requests OCR instead of indexing empty text', async () => {
    const buffer = createScannedPdf();
    await expect(parsePdfBuffer(buffer)).rejects.toThrow(/scanned image or contains no selectable text layer/);
  });

  it('rejects empty 0-byte buffer with explicit error', async () => {
    await expect(parsePdfBuffer(Buffer.alloc(0))).rejects.toThrow(/Empty file/);
  });

  it('rejects corrupt non-PDF buffer with explicit error', async () => {
    const corruptBuffer = Buffer.from('This is a corrupt file with no pdf header');
    await expect(parsePdfBuffer(corruptBuffer)).rejects.toThrow(/Invalid PDF format/);
  });

  it('parses plain text and markdown with proper page approximation', () => {
    const sampleText = 'Introduction to Operating Systems\n\nChapter 1 covers processes and threads.';
    const pages = parsePlainText(sampleText);
    expect(pages.length).toBe(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].text).toBe(sampleText);
  });
});
