// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore } from "@/lib/db";
import type { Embedder } from "./embeddings";
import type { Summarizer } from "./summarise";
import { answerQuestion } from "./chat";

let n = 0;
function freshStore() {
  n += 1;
  return new IndexedDbStore(`chat-test-${n}`);
}

const fallbackEmbedder: Embedder = {
  isAvailable: () => false,
  async embed() {
    throw new Error("unavailable");
  },
};

// A summarizer that echoes the retrieved entry bodies so the test can assert
// which entries were fed to it (i.e. retrieval correctness).
const echoSummarizer: Summarizer = {
  isAvailable: () => true,
  async summarise(prompt: string) {
    return prompt;
  },
};

const NOW = new Date(2026, 10, 2, 12, 0).getTime();

describe("answerQuestion (design §3.4 / §5)", () => {
  let store: IndexedDbStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("retrieves entries scoped by a year hint and feeds them to the summarizer", async () => {
    await store.createEntry({
      modality: "text",
      textContent: "2022 milestone: daughter started school",
      transcriptPending: false,
      createdAt: new Date(2022, 5, 1).getTime(),
    });
    await store.createEntry({
      modality: "text",
      textContent: "2024 unrelated note",
      transcriptPending: false,
      createdAt: new Date(2024, 2, 1).getTime(),
    });

    const answer = await answerQuestion(
      store,
      { embedder: fallbackEmbedder, summarizer: echoSummarizer, now: NOW },
      "what important things happened in 2022",
    );
    // echo summarizer returns the prompt → should contain the 2022 entry only.
    expect(answer).toMatch(/daughter started school/);
    expect(answer).not.toMatch(/2024 unrelated note/);
  });

  it("answers without a date filter when the question has no date hint", async () => {
    await store.createEntry({
      modality: "text",
      textContent: "grateful for family",
      transcriptPending: false,
      createdAt: NOW - 1000,
    });
    const answer = await answerQuestion(
      store,
      { embedder: fallbackEmbedder, summarizer: echoSummarizer, now: NOW },
      "what am I grateful for",
    );
    expect(answer).toMatch(/grateful for family/);
  });

  it("returns a graceful message when there are no entries at all", async () => {
    const answer = await answerQuestion(
      store,
      { embedder: fallbackEmbedder, summarizer: echoSummarizer, now: NOW },
      "anything?",
    );
    expect(answer).toMatch(/no matching entries|couldn't find|no entries/i);
  });

  it("limits retrieval to a top-K of entries", async () => {
    for (let i = 0; i < 10; i++) {
      await store.createEntry({
        modality: "text",
        textContent: `memory number ${i} about family`,
        transcriptPending: false,
        createdAt: NOW - i * 1000,
      });
    }
    const answer = await answerQuestion(
      store,
      {
        embedder: fallbackEmbedder,
        summarizer: echoSummarizer,
        now: NOW,
        topK: 3,
      },
      "family",
    );
    const entryCount = (answer.match(/Entry \d+ —/g) ?? []).length;
    expect(entryCount).toBeLessThanOrEqual(3);
  });
});
