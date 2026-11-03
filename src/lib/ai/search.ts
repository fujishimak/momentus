import type { Entry, MomentusStore } from "@/lib/db";
import type { Embedder } from "./embeddings";
import { rankByCosine } from "./cosine";

/** Embed the text used to represent an entry (text body or transcript). */
export function embedEntryText(
  embedder: Embedder,
  text: string,
): Promise<Float32Array> {
  return embedder.embed(text);
}

/**
 * Best-effort: embed an entry's text and persist its vector (FR9/FR12). Never
 * throws — embedding failures (model not ready, offline first load) must not
 * break the save flow. No-op for empty text (e.g. audio awaiting transcription).
 */
export async function embedAndStore(
  store: MomentusStore,
  embedder: Embedder,
  entryId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === "" || !embedder.isAvailable()) return;
  try {
    const vector = await embedder.embed(trimmed);
    await store.saveVector(entryId, vector);
  } catch {
    // Leave unembedded; substring search keeps it findable until backfilled.
  }
}

/**
 * Substring (keyword) search over entry text/transcript — the day-one fallback
 * when embeddings are unavailable (R1, FR12). Case-insensitive; an empty query
 * returns all entries (reverse-chronological, as the store lists them).
 */
export async function substringSearch(
  store: MomentusStore,
  query: string,
): Promise<Entry[]> {
  const entries = await store.listEntries();
  const q = query.trim().toLowerCase();
  if (q === "") return entries;
  return entries.filter((e) => e.textContent.toLowerCase().includes(q));
}

/**
 * Semantic search (FR12): embed the query, rank stored entry vectors by cosine
 * similarity, and return entries best-first. Degrades gracefully (R1):
 * - embedder unavailable → substring search;
 * - any error during embedding → substring search;
 * - entries without a stored vector are appended via substring match so they
 *   remain findable.
 */
export async function semanticSearch(
  store: MomentusStore,
  embedder: Embedder,
  query: string,
  topK?: number,
): Promise<Entry[]> {
  const q = query.trim();
  if (q === "") return store.listEntries();

  if (!embedder.isAvailable()) {
    return substringSearch(store, q);
  }

  let queryVector: Float32Array;
  try {
    queryVector = await embedder.embed(q);
  } catch {
    return substringSearch(store, q);
  }

  const [entries, vectors] = await Promise.all([
    store.listEntries(),
    store.listVectors(),
  ]);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const vectorItems = vectors
    .filter((v) => byId.has(v.entryId))
    .map((v) => ({ id: v.entryId, vector: v.vector }));

  const ranked = rankByCosine(queryVector, vectorItems, topK);
  const semanticResults = ranked
    .map((r) => byId.get(r.id))
    .filter((e): e is Entry => e !== undefined);

  // Include entries lacking a stored vector if they match by substring, so
  // nothing is unreachable while embeddings backfill (e.g. pending audio).
  const rankedIds = new Set(semanticResults.map((e) => e.id));
  const q2 = q.toLowerCase();
  const substringExtras = entries.filter(
    (e) => !rankedIds.has(e.id) && e.textContent.toLowerCase().includes(q2),
  );

  return [...semanticResults, ...substringExtras];
}
