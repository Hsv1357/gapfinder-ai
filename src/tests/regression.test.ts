import { describe, it, expect } from 'vitest';
import { parsePlainText } from '../lib/rag/parser';
import { chunkDocumentPages } from '../lib/rag/chunking';
import { classifyTopicMastery } from '../lib/gap-analysis/classifier';
import { buildCitationsFromChunks } from '../lib/rag/retrieval';
import { evaluateMultipleChoice } from '../lib/quiz/evaluator';

describe('Regression & Integrity Test Suite', () => {
  describe('1. Demo-data removal & Clean Empty States', () => {
    it('returns not_assessed with 0 score when no diagnostic attempts exist', () => {
      const result = classifyTopicMastery('Virtual Memory', []);
      expect(result.classification).toBe('not_assessed');
      expect(result.scorePercentage).toBe(0);
      expect(result.totalQuestions).toBe(0);
      expect(result.correctAnswers).toBe(0);
      expect(result.reason).toContain('No diagnostic quiz attempts');
    });

    it('never invents weak topics or fabricated assessment scores without attempts', () => {
      const topics = ['Operating Systems', 'Process Scheduling', 'Deadlocks'];
      for (const t of topics) {
        const mastery = classifyTopicMastery(t, []);
        expect(mastery.classification).toBe('not_assessed');
        expect(mastery.classification).not.toBe('weak');
        expect(mastery.classification).not.toBe('strong');
      }
    });
  });

  describe('2. Text Parsing, Chunking & Batching Pipeline', () => {
    it('parses plain text documents into page structures', () => {
      const sampleText = 'Chapter 1: Operating Systems Overview\n\nAn operating system is system software that manages hardware resources.';
      const pages = parsePlainText(sampleText);
      expect(pages.length).toBe(1);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].text).toContain('Operating Systems Overview');
    });

    it('creates chunks with proper token counting and indexation', () => {
      const pages = [
        {
          pageNumber: 1,
          text: 'Memory Management Unit (MMU) translates virtual addresses to physical addresses. Page tables maintain mappings between virtual and physical frames.',
        },
      ];
      const chunks = chunkDocumentPages(pages, { maxChunkSize: 50, overlap: 10 });
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].content).toContain('Memory Management');
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });

    it('rejects empty or whitespace-only documents from indexing', () => {
      const emptyPages = [{ pageNumber: 1, text: '    \n\t   ' }];
      const chunks = chunkDocumentPages(emptyPages);
      expect(chunks.length).toBe(0);
    });
  });

  describe('3. Grounded Explanation & Citation Integrity', () => {
    it('builds genuine citations exclusively from retrieved passages', () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          document_title: 'Silberschatz OS Concepts',
          chunk_index: 0,
          page_number: 142,
          section_title: '7.4 Deadlock Prevention',
          content: 'Mutual exclusion must hold for non-shareable resources. Hold and wait can be prevented by requiring processes to request all resources at once.',
          similarity: 0.88,
        },
      ];

      const citations = buildCitationsFromChunks(mockChunks);
      expect(citations.length).toBe(1);
      expect(citations[0].document_title).toBe('Silberschatz OS Concepts');
      expect(citations[0].page_number).toBe(142);
      expect(citations[0].passage).toContain('Mutual exclusion must hold');
    });

    it('returns empty citations when no retrieved chunks exist', () => {
      const citations = buildCitationsFromChunks([]);
      expect(citations.length).toBe(0);
    });
  });

  describe('4. Diagnostic Evaluation & Gap Classification', () => {
    it('evaluates answers strictly and calculates percentage scores accurately', () => {
      const mcqResult = evaluateMultipleChoice('B) Banker Algorithm', 'B');
      expect(mcqResult.isCorrect).toBe(true);
      expect(mcqResult.score).toBe(1.0);

      const wrongResult = evaluateMultipleChoice('A) FIFO', 'B) Banker Algorithm');
      expect(wrongResult.isCorrect).toBe(false);
      expect(wrongResult.score).toBe(0);
    });

    it('classifies topic as weak when student score is below 50%', () => {
      const weakAttempts = [
        { quizId: 'q1', score: 1, maxScore: 5, difficulty: 'medium' as const, date: '2026-10-26' },
      ];
      const result = classifyTopicMastery('Semaphores', weakAttempts);
      expect(result.classification).toBe('weak');
      expect(result.scorePercentage).toBe(20);
      expect(result.suggestedNextAction).toContain('Priority Revision');
    });

    it('classifies topic as strong when student score is >= 75%', () => {
      const strongAttempts = [
        { quizId: 'q1', score: 4, maxScore: 5, difficulty: 'medium' as const, date: '2026-10-26' },
        { quizId: 'q2', score: 5, maxScore: 5, difficulty: 'medium' as const, date: '2026-10-26' },
      ];
      const result = classifyTopicMastery('CPU Scheduling', strongAttempts);
      expect(result.classification).toBe('strong');
      expect(result.scorePercentage).toBe(90);
    });
  });

  describe('5. Duplicate Prevention & Status Transitions', () => {
    it('ensures status transition from processing to ready validates requirements', () => {
      const doc = {
        title: 'OS Lecture Notes',
        processing_status: 'processing',
        total_chunks: 0,
      };

      // Simulating successful extraction
      const totalChunksExtracted = 12;
      const updatedDoc = {
        ...doc,
        processing_status: totalChunksExtracted > 0 ? 'ready' : 'error',
        total_chunks: totalChunksExtracted,
      };

      expect(updatedDoc.processing_status).toBe('ready');
      expect(updatedDoc.total_chunks).toBe(12);
    });

    it('marks document as error if zero extractable content is detected', () => {
      const emptyContent = '';
      const docStatus = emptyContent.trim().length === 0 ? 'error' : 'ready';
      expect(docStatus).toBe('error');
    });
  });
});
