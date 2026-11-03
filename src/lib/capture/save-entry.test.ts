// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore } from "@/lib/db";
import { saveTextEntry, DailyLimitError, WordLimitError } from "./save-entry";

let n = 0;
function freshStore() {
  n += 1;
  return new IndexedDbStore(`save-entry-test-${n}`);
}

describe("saveTextEntry", () => {
  let store: IndexedDbStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("persists a text entry and returns it", async () => {
    const entry = await saveTextEntry(store, { text: "A calm morning" });
    expect(entry.modality).toBe("text");
    expect(entry.textContent).toBe("A calm morning");
    expect(entry.transcriptPending).toBe(false);
    const back = await store.getEntry(entry.id);
    expect(back?.textContent).toBe("A calm morning");
  });

  it("trims surrounding whitespace", async () => {
    const entry = await saveTextEntry(store, { text: "  spaced  " });
    expect(entry.textContent).toBe("spaced");
  });

  it("rejects empty text", async () => {
    await expect(saveTextEntry(store, { text: "   " })).rejects.toThrow(
      /empty/i,
    );
  });

  it("rejects text over 150 words with WordLimitError", async () => {
    const tooLong = Array.from({ length: 151 }, (_, i) => `w${i}`).join(" ");
    await expect(
      saveTextEntry(store, { text: tooLong }),
    ).rejects.toBeInstanceOf(WordLimitError);
  });

  it("attaches an optional photo and location", async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const entry = await saveTextEntry(store, {
      text: "with extras",
      photo,
      lat: 10,
      lng: 20,
    });
    const back = await store.getEntry(entry.id);
    expect(back?.photoBlob).toBeInstanceOf(Blob);
    expect(back?.lat).toBe(10);
    expect(back?.lng).toBe(20);
  });

  it("enforces the 5/day cap atomically and throws DailyLimitError on the 6th", async () => {
    const today = Date.now();
    for (let i = 0; i < 5; i++) {
      await saveTextEntry(store, { text: `entry ${i}`, now: today });
    }
    await expect(
      saveTextEntry(store, { text: "sixth", now: today }),
    ).rejects.toBeInstanceOf(DailyLimitError);
    // Still exactly 5 stored.
    const all = await store.listEntries();
    expect(all).toHaveLength(5);
  });

  it("counts the cap per-day, so a new day is allowed again", async () => {
    const day1 = new Date(2026, 0, 1, 12, 0).getTime();
    const day2 = new Date(2026, 0, 2, 12, 0).getTime();
    for (let i = 0; i < 5; i++) {
      await saveTextEntry(store, { text: `d1-${i}`, now: day1 });
    }
    // Day 2 should allow more.
    const e = await saveTextEntry(store, { text: "d2", now: day2 });
    expect(e.textContent).toBe("d2");
  });
});
