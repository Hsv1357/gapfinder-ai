import { RawPageText } from './chunking';

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
 * Server-compatible PDF text extractor using pdf.js legacy/server build.
 * Avoids browser-only DOMMatrix references and extracts clean page-by-page text with metadata.
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
    // Dynamic import of pdfjs-dist legacy build (Node.js server-compatible without DOMMatrix)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const doc = await loadingTask.promise;
    const totalPages = doc.numPages;

    if (totalPages === 0) {
      throw new Error('Empty PDF: The document contains 0 pages.');
    }

    const pages: RawPageText[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();

      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          const str = (item as any).str;
          const transform = (item as any).transform;

          if (transform && Array.isArray(transform) && transform.length >= 6) {
            const currentY = transform[5];
            if (lastY !== null && Math.abs(lastY - currentY) > 5) {
              pageText += '\n';
            } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
              pageText += ' ';
            }
            lastY = currentY;
          } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }

          pageText += str;
        }
      }

      const trimmedText = pageText.trim();
      if (trimmedText.length > 0) {
        pages.push({
          pageNumber: pageNum,
          text: trimmedText,
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
    // Handle standard PDF.js exceptions
    if (error.name === 'PasswordException') {
      throw new Error(
        'This PDF is password-protected or encrypted. Please remove password encryption before uploading.'
      );
    }
    if (error.name === 'InvalidPDFException' || error.name === 'FormatError') {
      throw new Error(
        'Corrupt or invalid PDF file: The PDF structure is damaged or cannot be parsed.'
      );
    }

    // Preserve our explicit error messages
    if (
      error.message?.includes('scanned image') ||
      error.message?.includes('Empty file') ||
      error.message?.includes('Invalid PDF format')
    ) {
      throw error;
    }

    console.error('PDF parsing error in server runtime:', error);
    throw new Error(`Failed to parse PDF document: ${error.message || 'Unknown parsing failure'}`);
  }
}
