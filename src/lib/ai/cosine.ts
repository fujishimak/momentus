/** Pure vector math for semantic ranking. No model, no I/O — fully testable. */

/** Cosine similarity in [-1, 1]. Returns 0 if either vector has zero norm. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface VectorItem {
  id: string;
  vector: Float32Array;
}

export interface RankedItem {
  id: string;
  score: number;
}

/**
 * Rank items by cosine similarity to the query vector, descending. Optionally
 * cap to the top K results.
 */
export function rankByCosine(
  query: Float32Array,
  items: VectorItem[],
  topK?: number,
): RankedItem[] {
  const scored = items
    .map((item) => ({
      id: item.id,
      score: cosineSimilarity(query, item.vector),
    }))
    .sort((a, b) => b.score - a.score);
  return typeof topK === "number" ? scored.slice(0, topK) : scored;
}
