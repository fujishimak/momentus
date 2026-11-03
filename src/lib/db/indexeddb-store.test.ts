// @vitest-environment node
//
// The storage layer is pure data logic with no DOM dependency. We run it under
// the Node environment (not jsdom) because Node 18+ ships a complete,
// spec-compliant Blob/Response/structuredClone, whereas jsdom's Blob cannot be
// read back (no .arrayBuffer()/.text(), Response(blob) fails). fake-indexeddb
// works identically under Node.
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore } from "./indexeddb-store";
import type { MomentusStore } from "./types";

// Each test gets a fresh database name so state never leaks between tests.
let dbCounter = 0;
function freshStore(): MomentusStore {
  dbCounter += 1;
  return new IndexedDbStore(`momentus-test-${dbCounter}`);
}

describe("IndexedDbStore — entries", () => {
  let store: MomentusStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("creates an entry and reads it back", async () => {
    const created = await store.createEntry({
      modality: "text",
      textContent: "A good day",
      transcriptPending: false,
    });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeGreaterThan(0);
    expect(created.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const fetched = await store.getEntry(created.id);
    expect(fetched?.textContent).toBe("A good day");
  });

  it("derives dayKey from createdAt when not provided", async () => {
    const ts = new Date(2025, 4, 10, 8, 0).getTime(); // 10 May 2025 local
    const created = await store.createEntry({
      modality: "text",
      textContent: "dated",
      transcriptPending: false,
      createdAt: ts,
    });
    expect(created.dayKey).toBe("2025-05-10");
  });

  it("lists entries in reverse-chronological order (FR11)", async () => {
    await store.createEntry({
      modality: "text",
      textContent: "first",
      transcriptPending: false,
      createdAt: 1000,
    });
    await store.createEntry({
      modality: "text",
      textContent: "second",
      transcriptPending: false,
      createdAt: 2000,
    });
    const list = await store.listEntries();
    expect(list.map((e) => e.textContent)).toEqual(["second", "first"]);
  });

  it("deletes an entry", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "temp",
      transcriptPending: false,
    });
    await store.deleteEntry(e.id);
    expect(await store.getEntry(e.id)).toBeUndefined();
  });

  it("counts entries for a given day (FR6)", async () => {
    const day = new Date(2026, 10, 2, 12, 0).getTime();
    for (let i = 0; i < 3; i++) {
      await store.createEntry({
        modality: "text",
        textContent: `e${i}`,
        transcriptPending: false,
        createdAt: day + i,
      });
    }
    // A different day should not be counted.
    await store.createEntry({
      modality: "text",
      textContent: "other",
      transcriptPending: false,
      createdAt: new Date(2026, 10, 3, 9, 0).getTime(),
    });
    expect(await store.countEntriesForDay("2026-11-02")).toBe(3);
    expect(await store.countEntriesForDay("2026-11-03")).toBe(1);
  });

  it("persists blobs for audio and photo", async () => {
    const audio = new Blob(["fake-audio"], { type: "audio/webm" });
    const photo = new Blob(["fake-photo"], { type: "image/jpeg" });
    const e = await store.createEntry({
      modality: "audio",
      textContent: "",
      transcriptPending: true,
      audioBlob: audio,
      photoBlob: photo,
      lat: 51.5,
      lng: -0.12,
    });
    const back = await store.getEntry(e.id);
    // The store rehydrates persisted bytes into real Blobs on read. We assert
    // type + byte length (reliable in jsdom); exact byte-content round-trip is
    // covered by the dedicated serialization test below, which avoids jsdom's
    // incomplete Blob/Response text reader.
    expect(back?.audioBlob).toBeInstanceOf(Blob);
    expect(back?.photoBlob).toBeInstanceOf(Blob);
    expect(back?.audioBlob?.type).toBe("audio/webm");
    expect(back?.photoBlob?.type).toBe("image/jpeg");
    expect(back?.audioBlob?.size).toBe(audio.size);
    expect(back?.photoBlob?.size).toBe(photo.size);
    expect(back?.lat).toBeCloseTo(51.5);
    expect(back?.transcriptPending).toBe(true);
  });

  it("round-trips blob bytes exactly through persistence", async () => {
    // Verify byte-exact content via the stored ArrayBuffer boundary, which is
    // environment-independent (does not rely on jsdom's Blob text reader).
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]);
    const audio = new Blob([bytes], { type: "audio/webm" });
    const e = await store.createEntry({
      modality: "audio",
      textContent: "",
      transcriptPending: true,
      audioBlob: audio,
    });
    const back = await store.getEntry(e.id);
    const buf = await new Response(back?.audioBlob).arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(bytes);
  });
});

describe("IndexedDbStore — vectors (FR12)", () => {
  let store: MomentusStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("saves and retrieves an embedding vector", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "vec",
      transcriptPending: false,
    });
    const v = new Float32Array([0.1, 0.2, 0.3]);
    await store.saveVector(e.id, v);
    const back = await store.getVector(e.id);
    expect(back).toBeInstanceOf(Float32Array);
    expect(Array.from(back!)).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
  });

  it("lists all vectors with their entry ids", async () => {
    const e1 = await store.createEntry({
      modality: "text",
      textContent: "a",
      transcriptPending: false,
    });
    const e2 = await store.createEntry({
      modality: "text",
      textContent: "b",
      transcriptPending: false,
    });
    await store.saveVector(e1.id, new Float32Array([1, 0]));
    await store.saveVector(e2.id, new Float32Array([0, 1]));
    const all = await store.listVectors();
    expect(all).toHaveLength(2);
    expect(all.map((x) => x.entryId).sort()).toEqual([e1.id, e2.id].sort());
  });
});

describe("IndexedDbStore — chat thread (design §3.4)", () => {
  let store: MomentusStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("appends and lists messages in chronological order", async () => {
    await store.appendChatMessage({
      role: "user",
      content: "hi",
      createdAt: 10,
    });
    await store.appendChatMessage({
      role: "assistant",
      content: "hello",
      createdAt: 20,
    });
    const msgs = await store.listChatMessages();
    expect(msgs.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  it("clears the thread", async () => {
    await store.appendChatMessage({ role: "user", content: "x" });
    await store.clearChat();
    expect(await store.listChatMessages()).toHaveLength(0);
  });
});

describe("IndexedDbStore — sync fields (M2, FR27-FR31)", () => {
  let store: MomentusStore;
  beforeEach(() => {
    store = freshStore();
  });

  it("defaults sync fields on create (updatedAt=createdAt, not deleted, local)", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "hello",
      transcriptPending: false,
      createdAt: 5000,
    });
    expect(e.updatedAt).toBe(5000);
    expect(e.deleted).toBe(false);
    expect(e.syncState).toBe("local");
  });

  it("updateEntry patches fields and bumps updatedAt", async () => {
    const e = await store.createEntry({
      modality: "audio",
      textContent: "",
      transcriptPending: true,
      createdAt: 1000,
    });
    const updated = await store.updateEntry(e.id, {
      textContent: "a transcript",
      transcriptPending: false,
      updatedAt: 2000,
    });
    expect(updated?.textContent).toBe("a transcript");
    expect(updated?.transcriptPending).toBe(false);
    expect(updated?.updatedAt).toBe(2000);
    const back = await store.getEntry(e.id);
    expect(back?.textContent).toBe("a transcript");
  });

  it("softDeleteEntry tombstones (hidden from listEntries, present for sync)", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "to delete",
      transcriptPending: false,
    });
    await store.softDeleteEntry(e.id);

    const visible = await store.listEntries();
    expect(visible.find((x) => x.id === e.id)).toBeUndefined();

    const forSync = await store.listEntriesForSync();
    const tomb = forSync.find((x) => x.id === e.id);
    expect(tomb?.deleted).toBe(true);
  });

  it("excludes tombstones from the daily count (FR6/FR32)", async () => {
    const day = new Date(2026, 10, 3, 12).getTime();
    const a = await store.createEntry({
      modality: "text",
      textContent: "a",
      transcriptPending: false,
      createdAt: day,
    });
    await store.createEntry({
      modality: "text",
      textContent: "b",
      transcriptPending: false,
      createdAt: day + 1,
    });
    expect(await store.countEntriesForDay(a.dayKey)).toBe(2);
    await store.softDeleteEntry(a.id);
    expect(await store.countEntriesForDay(a.dayKey)).toBe(1);
  });

  it("updateEntry returns undefined for a missing id", async () => {
    expect(
      await store.updateEntry("nope", { textContent: "x" }),
    ).toBeUndefined();
  });
});
