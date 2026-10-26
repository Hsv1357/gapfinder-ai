import { describe, it, expect } from 'vitest';
import { chunkDocumentPages, RawPageText } from '../lib/rag/chunking';

describe('Document Chunking', () => {
  it('correctly splits pages while preserving page numbers and section detection', () => {
    const pages: RawPageText[] = [
      {
        pageNumber: 1,
        text: `UNIT 1: DATABASE NORMALIZATION
Normalization is the process of organizing data in a database.
It involves creating tables and establishing relationships.
First normal form (1NF) sets the basic rules for an organized database.
Each column must contain only atomic values.
Second normal form (2NF) requires that the table is in 1NF and no non-prime attribute is dependent on any proper subset of any candidate key.`,
      },
      {
        pageNumber: 2,
        text: `Third normal form (3NF) requires 2NF compliance and no transitive dependencies.
Boyce-Codd Normal Form (BCNF) is a stricter version of 3NF.
Every determinant must be a candidate key in BCNF.`,
      },
    ];

    const chunks = chunkDocumentPages(pages, { maxChunkSize: 200, overlap: 30 });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].sectionTitle).toBe('UNIT 1: DATABASE NORMALIZATION');
    expect(chunks[0].content).toContain('Normalization');
    
    // Check that page 2 chunks preserve page 2
    const page2Chunks = chunks.filter((c) => c.pageNumber === 2);
    expect(page2Chunks.length).toBeGreaterThan(0);
    expect(page2Chunks[0].content).toContain('Third normal form');
  });

  it('handles empty pages gracefully without crashing', () => {
    const pages: RawPageText[] = [
      { pageNumber: 1, text: '' },
      { pageNumber: 2, text: '   \n  \t ' },
    ];
    const chunks = chunkDocumentPages(pages);
    expect(chunks).toEqual([]);
  });
});
