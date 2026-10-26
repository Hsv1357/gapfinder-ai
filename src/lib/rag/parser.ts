import { RawPageText } from './chunking';
import { extractText } from 'unpdf';

/**
 * Extracts page text from raw text or markdown.
 */
export function parsePlainText(content: string): RawPageText[] {
  if (!content || !content.trim()) {
    return [];
  }

  // Try splitting by common page delimiters if available (e.g., "--- Page 1 ---" or form feed "\f")
  if (content.includes('\f')) {
    const rawPages = content.split('\f');
    return rawPages
      .map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText.trim(),
      }))
      .filter((p) => p.text.length > 0);
  }

  // Otherwise approximate ~2500 characters per page if length > 3000
  if (content.length > 3000) {
    const pageSize = 2500;
    const pages: RawPageText[] = [];
    let offset = 0;
    let pageNum = 1;

    while (offset < content.length) {
      const slice = content.slice(offset, offset + pageSize);
      if (slice.trim()) {
        pages.push({
          pageNumber: pageNum++,
          text: slice.trim(),
        });
      }
      offset += pageSize;
    }
    return pages;
  }

  return [{ pageNumber: 1, text: content.trim() }];
}

/**
 * Server-compatible PDF text extractor using unpdf.
 * Completely eliminates browser DOMMatrix and external pdf.worker.mjs chunk loading failures
 * across all Node.js and Next.js Turbopack development and production runtimes.
 */
export async function parsePdfBuffer(
  buffer: Buffer
): Promise<{ pages: RawPageText[]; totalPages: number }> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file: The uploaded PDF file contains 0 bytes.');
  }

  // Basic check for %PDF- header magic bytes
  const header = buffer.subarray(0, 1024).toString('binary');
  if (!header.includes('%PDF-')) {
    throw new Error('Invalid PDF format: File header does not contain standard PDF magic marker.');
  }

  try {
    const data = new Uint8Array(buffer);
    const { totalPages, text: pageTexts } = await extractText(data, { mergePages: false });

    if (!totalPages || totalPages === 0 || !pageTexts || pageTexts.length === 0) {
      throw new Error('Empty PDF: The document contains 0 pages.');
    }

    const pages: RawPageText[] = [];

    for (let i = 0; i < pageTexts.length; i++) {
      const pageNum = i + 1;
      const rawText = (pageTexts[i] || '').trim();

      if (rawText.length > 0) {
        pages.push({
          pageNumber: pageNum,
          text: rawText,
        });
      }
    }

    // Gracefully handle scanned/image-only PDFs
    if (pages.length === 0 || pages.every((p) => !p.text.trim())) {
      throw new Error(
        'This PDF appears to be a scanned image or contains no selectable text layer. An OCR-processed document is required.'
      );
    }

    return {
      pages,
      totalPages,
    };
  } catch (error: any) {
    if (error.name === 'PasswordException' || error.message?.toLowerCase().includes('password')) {
      throw new Error(
        'This PDF is password-protected or encrypted. Please remove password encryption before uploading.'
      );
    }
    if (
      error.name === 'InvalidPDFException' ||
      error.name === 'FormatError' ||
      error.message?.includes('Invalid PDF') ||
      error.message?.includes('corrupt')
    ) {
      throw new Error(
        'Corrupt or invalid PDF file: The PDF structure is damaged or cannot be parsed.'
      );
    }

    // Preserve our explicit error messages
    if (
      error.message?.includes('scanned image') ||
      error.message?.includes('Empty file') ||
      error.message?.includes('Empty PDF') ||
      error.message?.includes('Invalid PDF format')
    ) {
      throw error;
    }

    console.error('PDF parsing error in server runtime:', error);
    throw new Error(`Failed to parse PDF document: ${error.message || 'Unknown parsing failure'}`);
  }
}
