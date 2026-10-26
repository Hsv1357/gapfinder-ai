import { RawPageText } from './chunking';

/**
 * Extracts page text from raw text or markdown.
 */
export function parsePlainText(content: string): RawPageText[] {
  // Try splitting by common page delimiters if available (e.g., "--- Page 1 ---" or form feed "\f")
  if (content.includes('\f')) {
    const rawPages = content.split('\f');
    return rawPages.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText.trim(),
    })).filter(p => p.text.length > 0);
  }

  // Otherwise approximate ~2500 characters per page if length > 3000
  if (content.length > 3000) {
    const pageSize = 2500;
    const pages: RawPageText[] = [];
    let offset = 0;
    let pageNum = 1;

    while (offset < content.length) {
      const slice = content.slice(offset, offset + pageSize);
      pages.push({
        pageNumber: pageNum++,
        text: slice.trim(),
      });
      offset += pageSize;
    }
    return pages;
  }

  return [{ pageNumber: 1, text: content.trim() }];
}

/**
 * Parses PDF buffer into structured page-level text.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<{ pages: RawPageText[]; totalPages: number }> {
  try {
    // Dynamic import to avoid client bundle inclusion
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require('pdf-parse');
    
    // Custom pagerender to capture individual pages if supported
    const pageTexts: RawPageText[] = [];
    
    const options = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY: number | null = null;
          let text = '';
          for (const item of textContent.items) {
            if (lastY == null || Math.abs(lastY - item.transform[5]) > 5) {
              text += '\n' + item.str;
            } else {
              text += ' ' + item.str;
            }
            lastY = item.transform[5];
          }
          pageTexts.push({
            pageNumber: pageData.pageIndex + 1,
            text: text.trim(),
          });
          return text;
        });
      }
    };

    const data = await pdf(buffer, options);

    // If pageTexts was successfully populated by pagerender
    if (pageTexts.length > 0) {
      pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);
      return {
        pages: pageTexts.filter(p => p.text.length > 0),
        totalPages: data.numpages || pageTexts.length,
      };
    }

    // Fallback using data.text
    const fallbackPages = parsePlainText(data.text);
    return {
      pages: fallbackPages,
      totalPages: data.numpages || fallbackPages.length,
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF document: ${error.message || 'Corrupt or unsupported PDF file'}`);
  }
}
