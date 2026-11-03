// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore, type Entry } from "@/lib/db";
import type { Embedder } from "./embeddings";
import { semanticSearch, substringSearch, embedEntryText } from "./search";

let n = 0;
function freshStore() {
  n += 1;
  return new IndexedDbStore(`search-test-${n}`);
}

/**
 * Deterministic fake embedder: maps a few known words to fixed 2-D vectors so
 * cosine ranking is predictable without loading a real model.
 */
const vocab: Record<string, [number, number]> = {
  family: [1, 0],
  work: [0, 1],
  dinner: [0.9, 0.1],
};
const fakeEmbedder: Embedder = {
  isAvailable: () => true,
  async embed(text: string) {
    const lower = text.toLowerCase();
    for (const [word, vec] of Object.entries(vocab)) {
      if (lower.includes(word)) return Float32Array.from(vec);
    }
    return Float32Array.from([0.5, 0.5]);
  },
};

const unavailableEmbedder: Embedder = {
  isAvailable: () => false,
  async embed() {
    throw new Error("unavailable");
  },
};

async function seed(store: IndexedDbStore): Promise<Entry[]> {
  const fam = await store.createEntry({
    modality: "text",
    textContent: "grateful for my family",
    transcriptPending: false,
  });
  const job = await store.createEntry({
    modality: "text",
    textContent: "stressed about work deadline",
    transcriptPending: false,
  });
  await store.saveVector(fam.id, Float32Array.from([1, 0]));
  await store.saveVector(job.id, Float32Array.from([0, 1]));
  return [fam, job];
}

describe("semanticSearch (FR12)", () => {
  let store: IndexedDbStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("ranks entries by similarity to the embedded query", async () => {
    const [fam] = await seed(store);
    const results = await semanticSearch(store, fakeEmbedder, "my family");
    expect(results[0].id).toBe(fam.id);
  });

  it("returns the better match first for a different query", async () => {
    const [, job] = await seed(store);
    const results = await semanticSearch(store, fakeEmbedder, "work stuff");
    expect(results[0].id).toBe(job.id);
  });

  it("falls back to substring search when the embedder is unavailable (R1)", async () => {
    await seed(store);
    const results = await semanticSearch(
      store,
      unavailableEmbedder,
      "deadline",
    );
    expect(results).toHaveLength(1);
    expect(results[0].textContent).toMatch(/deadline/i);
  });

  it("falls back to substring search when an entry has no stored vector", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "no vector here deadline",
      transcriptPending: false,
    });
    // No saveVector for e → not rankable semantically.
    const results = await semanticSearch(store, fakeEmbedder, "deadline");
    expect(results.map((r) => r.id)).toContain(e.id);
  });
});

describe("substringSearch (FR12 fallback)", () => {
  let store: IndexedDbStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("matches text case-insensitively", async () => {
    await seed(store);
    const results = await substringSearch(store, "FAMILY");
    expect(results).toHaveLength(1);
    expect(results[0].textContent).toMatch(/family/i);
  });

  it("returns all entries for an empty query", async () => {
    await seed(store);
    const results = await substringSearch(store, "");
    expect(results).toHaveLength(2);
  });
});

describe("embedEntryText", () => {
  it("uses the entry text for embedding", async () => {
    const vec = await embedEntryText(fakeEmbedder, "grateful for my family");
    expect(Array.from(vec)).toEqual([1, 0]);
  });
});
