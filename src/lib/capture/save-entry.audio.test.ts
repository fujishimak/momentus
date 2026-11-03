// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore } from "@/lib/db";
import { saveAudioEntry, DailyLimitError } from "./save-entry";

let n = 0;
function freshStore() {
  n += 1;
  return new IndexedDbStore(`save-audio-test-${n}`);
}

function fakeAudio(): Blob {
  return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });
}

describe("saveAudioEntry", () => {
  let store: IndexedDbStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("persists an audio entry with the blob and transcriptPending=true", async () => {
    const entry = await saveAudioEntry(store, { audio: fakeAudio() });
    expect(entry.modality).toBe("audio");
    expect(entry.transcriptPending).toBe(true);
    expect(entry.textContent).toBe("");
    const back = await store.getEntry(entry.id);
    expect(back?.audioBlob).toBeInstanceOf(Blob);
  });

  it("rejects a missing/empty audio blob", async () => {
    await expect(
      saveAudioEntry(store, { audio: new Blob([], { type: "audio/webm" }) }),
    ).rejects.toThrow(/audio/i);
  });

  it("attaches optional photo and location", async () => {
    const photo = new Blob([new Uint8Array([9])], { type: "image/jpeg" });
    const entry = await saveAudioEntry(store, {
      audio: fakeAudio(),
      photo,
      lat: 1.23,
      lng: 4.56,
    });
    const back = await store.getEntry(entry.id);
    expect(back?.photoBlob).toBeInstanceOf(Blob);
    expect(back?.lat).toBeCloseTo(1.23);
  });

  it("enforces the 5/day cap shared with text entries (FR6)", async () => {
    const today = Date.now();
    for (let i = 0; i < 5; i++) {
      await saveAudioEntry(store, { audio: fakeAudio(), now: today });
    }
    await expect(
      saveAudioEntry(store, { audio: fakeAudio(), now: today }),
    ).rejects.toBeInstanceOf(DailyLimitError);
    expect(await store.listEntries()).toHaveLength(5);
  });
});
