export interface RawPageText {
  pageNumber: number;
  text: string;
}

export interface ChunkResult {
  chunkIndex: number;
  pageNumber: number;
  sectionTitle: string | null;
  content: string;
  tokenCount: number;
}

export interface ChunkingOptions {
  maxChunkSize?: number; // Target characters per chunk
  overlap?: number;      // Character overlap
}

/**
 * Splits text into chunks while preserving sentence boundaries, page numbers,
 * and detecting major section headers.
 */
export function chunkDocumentPages(
  pages: RawPageText[],
  options: ChunkingOptions = {}
): ChunkResult[] {
  const maxChunkSize = options.maxChunkSize || 1000;
  const overlap = options.overlap || 150;

  const chunks: ChunkResult[] = [];
  let chunkIndex = 0;
  let currentSectionTitle: string | null = null;

  for (const page of pages) {
    const rawText = page.text.replace(/\r\n/g, '\n').trim();
    if (!rawText) continue;

    // Detect section titles if line looks like a title: short line ending with no punctuation or capitalized
    const lines = rawText.split('\n');
    const cleanedParagraphs: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Section header detection heuristic (e.g. "Chapter 3: Thermodynamics", "UNIT 1: ARRAYS")
      if (
        (trimmed.length < 80 && /^(unit|chapter|section|module|part)\s+\d+/i.test(trimmed)) ||
        (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && trimmed.length > 4)
      ) {
        currentSectionTitle = trimmed;
      }

      cleanedParagraphs.push(trimmed);
    }

    const fullPageText = cleanedParagraphs.join('\n');

    // Split page text into sentences/segments
    const sentences = fullPageText.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [fullPageText];

    let currentChunkText = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      if ((currentChunkText + ' ' + sentence).length > maxChunkSize && currentChunkText.length > 0) {
        // Commit current chunk
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: page.pageNumber,
          sectionTitle: currentSectionTitle,
          content: currentChunkText.trim(),
          tokenCount: Math.ceil(currentChunkText.length / 4), // standard approximation
        });

        // Compute overlap from the end of current chunk
        const words = currentChunkText.split(' ');
        const overlapWords = words.slice(-Math.min(words.length, Math.floor(overlap / 6))).join(' ');
        currentChunkText = overlapWords + ' ' + sentence;
      } else {
        currentChunkText = currentChunkText ? `${currentChunkText} ${sentence}` : sentence;
      }
    }

    // Flush remaining text for page
    if (currentChunkText.trim().length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        sectionTitle: currentSectionTitle,
        content: currentChunkText.trim(),
        tokenCount: Math.ceil(currentChunkText.length / 4),
      });
    }
  }

  return chunks;
}
