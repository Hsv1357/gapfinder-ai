import { generateEmbedding } from '../gemini';
import { Citation } from '@/types/database';

export interface RetrievedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  page_number: number | null;
  section_title: string | null;
  content: string;
  similarity: number;
  document_title: string;
}

export interface RetrievalOptions {
  userId: string;
  subjectId?: string;
  query: string;
  matchCount?: number;
  threshold?: number;
  supabaseClient: any;
}

/**
 * Executes vector search across authorized document chunks using Gemini embedding and pgvector.
 * Includes a resilient fallback to ILIKE text search if the vector RPC is not yet created.
 */
export async function retrieveRelevantChunks({
  userId,
  subjectId,
  query,
  matchCount = 5,
  threshold = 0.45,
  supabaseClient,
}: RetrievalOptions): Promise<RetrievedChunk[]> {
  try {
    // 1. Generate query embedding using Gemini
    const queryVector = await generateEmbedding(query);

    // 2. Call Supabase RPC function
    const { data, error } = await supabaseClient.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: threshold,
      match_count: matchCount,
      filter_user_id: userId,
      filter_subject_id: subjectId || null,
    });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data as RetrievedChunk[];
    }

    if (error) {
      console.warn('Vector search RPC error (falling back to keyword matching):', error.message);
    }
  } catch (err: any) {
    console.warn('Embedding generation / RPC search failed, attempting fallback keyword retrieval:', err.message);
  }

  // Fallback: Keyword search across user chunks
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter((k) => k.length > 3)
      .slice(0, 5);

    let queryBuilder = supabaseClient
      .from('document_chunks')
      .select('id, document_id, chunk_index, page_number, section_title, content, documents!inner(title)')
      .eq('user_id', userId);

    if (subjectId) {
      queryBuilder = queryBuilder.eq('subject_id', subjectId);
    }

    if (keywords.length > 0) {
      // Build ILIKE query with first prominent keyword
      queryBuilder = queryBuilder.ilike('content', `%${keywords[0]}%`);
    }

    const { data: fallbackChunks, error: fallbackError } = await queryBuilder.limit(matchCount);

    if (fallbackError || !fallbackChunks) {
      return [];
    }

    return fallbackChunks.map((chunk: any) => ({
      id: chunk.id,
      document_id: chunk.document_id,
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      section_title: chunk.section_title,
      content: chunk.content,
      similarity: 0.75, // nominal score for keyword match
      document_title: chunk.documents?.title || 'Uploaded Document',
    }));
  } catch (fallbackCatch) {
    console.error('Fallback keyword search error:', fallbackCatch);
    return [];
  }
}

/**
 * Converts retrieved chunks to structured citations.
 */
export function buildCitationsFromChunks(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((c) => ({
    document_title: c.document_title,
    page_number: c.page_number,
    section_title: c.section_title,
    passage: c.content.slice(0, 280) + (c.content.length > 280 ? '...' : ''),
    similarity: c.similarity,
  }));
}
