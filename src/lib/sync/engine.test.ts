// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore, type MomentusStore } from "@/lib/db";
import { SyncEngine, type SyncServer } from "./engine";
import type { SyncEntry, PullResponse, BlobPointer } from "./types";

let n = 0;
function freshStore(): MomentusStore {
  n += 1;
  return new IndexedDbStore(`sync-engine-test-${n}`);
}

/** In-memory fake server: holds SyncEntry rows, implements push (LWW) + pull. */
class FakeServer implements SyncServer {
  rows = new Map<string, SyncEntry>();
  blobs: { kind: string; bytes: number }[] = [];

  async uploadBlob(kind: "audio" | "photo", blob: Blob): Promise<BlobPointer> {
    this.blobs.push({ kind, bytes: blob.size });
    return {
      url: `https://blob.test/${kind}-${this.blobs.length}`,
      type: blob.type || "application/octet-stream",
      size: blob.size,
    };
  }

  async push(entries: SyncEntry[]): Promise<void> {
    for (const e of entries) {
      const existing = this.rows.get(e.id);
      if (!existing || e.updatedAt > existing.updatedAt) this.rows.set(e.id, e);
    }
  }

  async pull(since: number): Promise<PullResponse> {
    const entries = [...this.rows.values()].filter((e) => e.updatedAt > since);
    const cursor = entries.reduce((m, e) => Math.max(m, e.updatedAt), since);
    return { entries, cursor };
  }
}

describe("SyncEngine.push (FR29/FR31)", () => {
  let store: MomentusStore;
  let server: FakeServer;
  let engine: SyncEngine;
  beforeEach(() => {
    store = freshStore();
    server = new FakeServer();
    engine = new SyncEngine(store, server);
  });

  it("pushes a local text entry and marks it synced", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "hello",
      transcriptPending: false,
    });
    await engine.push();
    expect(server.rows.has(e.id)).toBe(true);
    const back = await store.getEntry(e.id);
    expect(back?.syncState).toBe("synced");
  });

  it("uploads audio/photo blobs and sends pointers, not bytes (FR28)", async () => {
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const photo = new Blob([new Uint8Array([4, 5])], { type: "image/jpeg" });
    const e = await store.createEntry({
      modality: "audio",
      textContent: "",
      transcriptPending: true,
      audioBlob: audio,
      photoBlob: photo,
    });
    await engine.push();
    expect(server.blobs.map((b) => b.kind).sort()).toEqual(["audio", "photo"]);
    const row = server.rows.get(e.id)!;
    expect(row.audio?.url).toMatch(/blob\.test\/audio/);
    expect(row.photo?.url).toMatch(/blob\.test\/photo/);
    const back = await store.getEntry(e.id);
    expect(back?.audioUrl).toBe(row.audio?.url);
    expect(back?.syncState).toBe("synced");
  });

  it("does not re-upload a blob already uploaded (idempotent)", async () => {
    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await store.createEntry({
      modality: "audio",
      textContent: "",
      transcriptPending: true,
      audioBlob: audio,
    });
    await engine.push();
    await engine.push();
    expect(server.blobs.filter((b) => b.kind === "audio")).toHaveLength(1);
  });

  it("pushes tombstones so deletes propagate (FR30)", async () => {
    const e = await store.createEntry({
      modality: "text",
      textContent: "bye",
      transcriptPending: false,
    });
    await engine.push();
    await store.softDeleteEntry(e.id);
    await engine.push();
    expect(server.rows.get(e.id)?.deleted).toBe(true);
  });
});

describe("SyncEngine.pull (FR29/FR30 LWW)", () => {
  let store: MomentusStore;
  let server: FakeServer;
  let engine: SyncEngine;
  beforeEach(() => {
    store = freshStore();
    server = new FakeServer();
    engine = new SyncEngine(store, server);
  });

  it("creates a local entry from a remote one", async () => {
    server.rows.set("remote1", {
      id: "remote1",
      createdAt: 1000,
      updatedAt: 1000,
      deleted: false,
      modality: "text",
      textContent: "from device B",
      transcriptPending: false,
      dayKey: "2026-11-03",
    });
    await engine.pull();
    const local = await store.getEntry("remote1");
    expect(local?.textContent).toBe("from device B");
  });

  it("applies a newer remote update (LWW) over the local copy", async () => {
    const e = await store.createEntry({
      id: "shared",
      modality: "text",
      textContent: "old local",
      transcriptPending: false,
      createdAt: 1000,
      updatedAt: 1000,
    });
    server.rows.set("shared", {
      id: "shared",
      createdAt: 1000,
      updatedAt: 5000,
      deleted: false,
      modality: "text",
      textContent: "newer remote",
      transcriptPending: false,
      dayKey: e.dayKey,
    });
    await engine.pull();
    expect((await store.getEntry("shared"))?.textContent).toBe("newer remote");
  });

  it("does NOT overwrite a newer local copy with an older remote (LWW)", async () => {
    await store.createEntry({
      id: "shared",
      modality: "text",
      textContent: "newer local",
      transcriptPending: false,
      createdAt: 1000,
      updatedAt: 9000,
    });
    server.rows.set("shared", {
      id: "shared",
      createdAt: 1000,
      updatedAt: 3000,
      deleted: false,
      modality: "text",
      textContent: "older remote",
      transcriptPending: false,
      dayKey: "2026-11-03",
    });
    await engine.pull();
    expect((await store.getEntry("shared"))?.textContent).toBe("newer local");
  });

  it("applies a remote tombstone (removes from the visible list)", async () => {
    await store.createEntry({
      id: "shared",
      modality: "text",
      textContent: "will be deleted remotely",
      transcriptPending: false,
      createdAt: 1000,
      updatedAt: 1000,
    });
    server.rows.set("shared", {
      id: "shared",
      createdAt: 1000,
      updatedAt: 5000,
      deleted: true,
      modality: "text",
      textContent: "",
      transcriptPending: false,
      dayKey: "2026-11-03",
    });
    await engine.pull();
    expect((await store.getEntry("shared"))?.deleted).toBe(true);
    expect(await store.listEntries()).toHaveLength(0);
  });

  it("advances the cursor so a second pull fetches nothing new", async () => {
    server.rows.set("r1", {
      id: "r1",
      createdAt: 1000,
      updatedAt: 1000,
      deleted: false,
      modality: "text",
      textContent: "x",
      transcriptPending: false,
      dayKey: "2026-11-03",
    });
    await engine.pull();
    const firstCursor = engine.getCursor();
    expect(firstCursor).toBe(1000);
    // Nothing newer → cursor unchanged, no error.
    await engine.pull();
    expect(engine.getCursor()).toBe(1000);
  });
});
