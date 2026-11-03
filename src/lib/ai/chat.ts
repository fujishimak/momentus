import type { Entry, MomentusStore } from "@/lib/db";
import type { Embedder } from "./embeddings";
import { semanticSearch } from "./search";
import { parseDateHint } from "./date-hints";
import { buildPrompt, resolveSummarizer, type Summarizer } from "./summarise";

export interface AnswerOptions {
  embedder: Embedder;
  /** Native summarizer (Apple Foundation Models on device); optional. */
  summarizer?: Summarizer;
  /** Max entries to feed the summarizer (default 5). */
  topK?: number;
  /** Injectable clock for deterministic date-hint parsing. */
  now?: number;
}

const DEFAULT_TOP_K = 5;

/**
 * Answer a chat question from the user's own entries (design §3.4, §5):
 * 1. parse any date hint ("1 year ago", "in 2022") → date range;
 * 2. retrieve by semantic search (substring fallback, R1), scoped to the range;
 * 3. build a grounded prompt from the top-K entries;
 * 4. summarise via the native model when available, else extractive (R1).
 *
 * Fully on-device (NFR4): nothing leaves the device. The generation step is the
 * only non-deterministic part and is injected, so this function is testable.
 */
export async function answerQuestion(
  store: MomentusStore,
  options: AnswerOptions,
  question: string,
): Promise<string> {
  const now = options.now ?? Date.now();
  const topK = options.topK ?? DEFAULT_TOP_K;

  // 1 + 2: retrieve by query, then apply the date range if the question
  // implies one. If query retrieval finds nothing in scope (common with the
  // substring fallback, since a full natural-language question rarely matches
  // entry text verbatim), fall back to the most recent entries in scope so the
  // assistant can still answer from the journal.
  const ranked = await semanticSearch(store, options.embedder, question);
  const range = parseDateHint(question, now);
  const inRange = (e: Entry) =>
    !range || (e.createdAt >= range.start && e.createdAt <= range.end);

  let scoped = ranked.filter(inRange);
  if (scoped.length === 0) {
    const all = await store.listEntries(); // reverse-chronological
    scoped = all.filter(inRange);
  }
  const top = scoped.slice(0, topK);

  // 3 + 4: build grounded prompt, summarise (native if available else extractive).
  const prompt = buildPrompt(question, top);
  const summarizer = resolveSummarizer(options.summarizer);
  return summarizer.summarise(prompt);
}
