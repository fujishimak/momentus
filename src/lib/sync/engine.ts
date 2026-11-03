import type { Entry, MomentusStore } from "@/lib/db";
import type { SyncEntry, PullResponse, BlobPointer, Modality } from "./types";

/**
 * Transport the engine depends on. The HTTP implementation (talking to
 * /api/entries + /api/blob) lives in `client.ts`; tests inject a fake. This
 * keeps the sync merge/queue logic unit-testable without a network.
 */
export interface SyncServer {
  uploadBlob(kind: "audio" | "photo", blob: Blob): Promise<BlobPointer>;
  push(entries: SyncEntry[]): Promise<void>;
  pull(since: number): Promise<PullResponse>;
}

/** Convert a local Entry (already blob-uploaded) to the wire DTO. */
function toWire(e: Entry): SyncEntry {
  return {
    id: e.id,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt ?? e.createdAt,
    deleted: e.deleted ?? false,
    modality: e.modality,
    textContent: e.textContent,
    transcriptPending: e.transcriptPending,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    dayKey: e.dayKey,
    audio: e.audioUrl
      ? {
          url: e.audioUrl,
          type: e.audioBlob?.type ?? "audio/webm",
          size: e.audioBlob?.size ?? 0,
        }
      : null,
    photo: e.photoUrl
      ? {
          url: e.photoUrl,
          type: e.photoBlob?.type ?? "image/jpeg",
          size: e.photoBlob?.size ?? 0,
        }
      : null,
  };
}

/**
 * Local-first background sync engine (FR29-FR31).
 *
 * push: upload any pending blobs, then send all locally-changed entries
 *   (anything not `synced`) to the server; mark them synced.
 * pull: fetch entries changed since the cursor and merge by last-write-wins
 *   (FR30), including tombstones.
 *
 * The engine is intentionally dependency-injected (store + server) and holds
 * only the pull cursor, so it is fully unit-testable.
 */
export class SyncEngine {
  private cursor = 0;

  constructor(
    private readonly store: MomentusStore,
    private readonly server: SyncServer,
  ) {}

  getCursor(): number {
    return this.cursor;
  }

  setCursor(value: number): void {
    this.cursor = value;
  }

  /** Push every entry that isn't fully synced (FR29). Uploads blobs first so
   * only pointers are sent (FR28/FR31); idempotent (won't re-upload). */
  async push(): Promise<void> {
    const all = await this.store.listEntriesForSync();
    const pending = all.filter((e) => e.syncState !== "synced");

    for (const entry of pending) {
      let audioUrl = entry.audioUrl;
      let photoUrl = entry.photoUrl;

      if (entry.audioBlob && !audioUrl) {
        audioUrl = (await this.server.uploadBlob("audio", entry.audioBlob)).url;
      }
      if (entry.photoBlob && !photoUrl) {
        photoUrl = (await this.server.uploadBlob("photo", entry.photoBlob)).url;
      }

      // Persist the pointers locally before/so a retry won't re-upload.
      if (audioUrl !== entry.audioUrl || photoUrl !== entry.photoUrl) {
        await this.store.updateEntry(entry.id, {
          audioUrl,
          photoUrl,
          updatedAt: entry.updatedAt ?? entry.createdAt, // keep LWW key stable
        });
      }

      const wire = toWire({ ...entry, audioUrl, photoUrl });
      await this.server.push([wire]);
      await this.store.updateEntry(entry.id, {
        syncState: "synced",
        updatedAt: entry.updatedAt ?? entry.createdAt,
      });
    }
  }

  /** Pull remote changes since the cursor and LWW-merge them locally (FR30). */
  async pull(): Promise<void> {
    const { entries, cursor } = await this.server.pull(this.cursor);
    for (const remote of entries) {
      await this.mergeRemote(remote);
    }
    if (cursor > this.cursor) this.cursor = cursor;
  }

  private async mergeRemote(remote: SyncEntry): Promise<void> {
    const local = await this.store.getEntry(remote.id);
    const localUpdated = local?.updatedAt ?? local?.createdAt ?? -1;

    // Last-write-wins: only apply a strictly newer remote (FR30).
    if (local && remote.updatedAt <= localUpdated) return;

    const patch: Partial<Entry> = {
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      deleted: remote.deleted,
      modality: remote.modality as Modality,
      textContent: remote.textContent,
      transcriptPending: remote.transcriptPending,
      lat: remote.lat ?? undefined,
      lng: remote.lng ?? undefined,
      dayKey: remote.dayKey,
      audioUrl: remote.audio?.url,
      photoUrl: remote.photo?.url,
      syncState: "synced",
    };

    if (local) {
      await this.store.updateEntry(remote.id, patch);
    } else {
      await this.store.createEntry({
        id: remote.id,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        deleted: remote.deleted,
        modality: remote.modality as Modality,
        textContent: remote.textContent,
        transcriptPending: remote.transcriptPending,
        lat: remote.lat ?? undefined,
        lng: remote.lng ?? undefined,
        dayKey: remote.dayKey,
        audioUrl: remote.audio?.url,
        photoUrl: remote.photo?.url,
        syncState: "synced",
      });
    }
  }
}
