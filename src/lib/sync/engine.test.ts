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
  /** Test hook: runs inside push(), simulating work landing mid-network-call. */
  onPush?: () => Promise<void>;

  async uploadBlob(kind: "audio" | "photo", blob: Blob): Promise<BlobPointer> {
    this.blobs.push({ kind, bytes: blob.size });
    return {
      url: `https://blob.test/${kind}-${this.blobs.length}`,
      type: blob.type || "application/octet-stream",
      size: blob.size,
    };
  }

  async push(entries: SyncEntry[]): Promise<void> {
    if (this.onPush) await this.onPush();
    for (const e of entries) {
      const existing = this.rows.get(e.id);
      if (!existing || e.updatedAt > existing.updatedAt) this.rows.set(e.id, e);
    }
  }

  async pull(
    since: number,
    sinceId?: string,
    limit?: number,
  ): Promise<PullResponse> {
    const all = [...this.rows.values()]
      .filter(
        (e) =>
          e.updatedAt > since ||
          (e.updatedAt === since && sinceId !== undefined && e.id > sinceId),
      )
      .sort((a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : 1));
    const take = limit ?? all.length;
    const pageRows = all.slice(0, take);
    const hasMore = all.length > take;
    const last = pageRows[pageRows.length - 1];
    return {
      entries: pageRows,
      cursor: last ? last.updatedAt : since,
      cursorId: last ? last.id : undefined,
      hasMore,
    };
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

describe("SyncEngine.push mid-push lost-update race (hardening)", () => {
  let store: MomentusStore;
  let server: FakeServer;
  let engine: SyncEngine;
  beforeEach(() => {
    store = freshStore();
    server = new FakeServer();
    engine = new SyncEngine(store, server);
  });

  it("does not clobber a concurrent local edit made during the push network await", async () => {
    // An entry is queued for push.
    const e = await store.createEntry({
      id: "racey",
      modality: "text",
      textContent: "original",
      transcriptPending: false,
      createdAt: 1000,
      updatedAt: 1000,
    });

    // Simulate a concurrent writer (an edit, or a pull merge) landing WHILE the
    // server.push() network call is in flight: the entry's content + LWW key
    // (updatedAt) move forward and it goes back to a non-synced state.
    let fired = false;
    server.onPush = async () => {
      if (fired) return;
      fired = true;
      await store.updateEntry(e.id, {
        textContent: "edited mid-push",
        updatedAt: 5000,
        syncState: "local",
      });
    };

    await engine.push();

    const back = await store.getEntry(e.id);
    // The newer edit must survive: its content and LWW key must not be
    // overwritten by the stale snapshot captured before the push started.
    expect(back?.textContent).toBe("edited mid-push");
    expect(back?.updatedAt).toBe(5000);
    // And because it changed under us, it must NOT be marked synced — the next
    // push has to pick up the newer version.
    expect(back?.syncState).not.toBe("synced");
  });

  it("marks the entry synced when nothing changed during the push", async () => {
    await store.createEntry({
      id: "calm",
      modality: "text",
      textContent: "stable",
      transcriptPending: false,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await engine.push();
    const back = await store.getEntry("calm");
    expect(back?.syncState).toBe("synced");
    expect(back?.textContent).toBe("stable");
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

  it("pulls a large backlog across multiple pages (NFR13 cold reconnect)", async () => {
    // Seed more rows than one page holds.
    const N = 25;
    for (let i = 1; i <= N; i++) {
      server.rows.set(`r${i}`, {
        id: `r${i}`,
        createdAt: 1000 + i,
        updatedAt: 1000 + i,
        deleted: false,
        modality: "text",
        textContent: `entry ${i}`,
        transcriptPending: false,
        dayKey: "2026-11-03",
      });
    }
    engine.setPageLimit(10); // force several pages
    await engine.pull();

    // Every remote entry must be merged locally despite paging.
    const local = await store.listEntries();
    expect(local).toHaveLength(N);
    // Cursor advanced to the newest.
    expect(engine.getCursor()).toBe(1000 + N);
    // A follow-up pull fetches nothing new.
    const before = engine.getCursor();
    await engine.pull();
    expect(engine.getCursor()).toBe(before);
  });

  it("does not skip entries that share an updatedAt across a page boundary (tie-safe)", async () => {
    // Three entries at the SAME updatedAt, page size 2 → boundary splits them.
    for (const id of ["a", "b", "c"]) {
      server.rows.set(id, {
        id,
        createdAt: 5000,
        updatedAt: 5000,
        deleted: false,
        modality: "text",
        textContent: id,
        transcriptPending: false,
        dayKey: "2026-11-03",
      });
    }
    engine.setPageLimit(2);
    await engine.pull();
    const local = await store.listEntriesForSync();
    expect(local.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });
});
