import {
  type Entry,
  type NewEntry,
  type ChatMessage,
  type NewChatMessage,
  type MomentusStore,
} from "./types";
import { dayKeyOf } from "@/lib/limits";

const DB_VERSION = 2;
const STORE_ENTRIES = "entries";
const STORE_VECTORS = "vectors";
const STORE_CHAT = "chat";

/** Serialized blob form: raw bytes + MIME type. ArrayBuffers survive IndexedDB
 * structured clone reliably across engines (and map cleanly to SQLite BLOBs on
 * the native backend), whereas Blob identity does not. */
interface StoredBlob {
  bytes: ArrayBuffer;
  type: string;
}

/** On-disk shape of an entry: blobs are stored as {@link StoredBlob}. */
type StoredEntry = Omit<Entry, "audioBlob" | "photoBlob"> & {
  audioBlob?: StoredBlob;
  photoBlob?: StoredBlob;
};

async function toStoredBlob(
  blob: Blob | undefined,
): Promise<StoredBlob | undefined> {
  if (!blob) return undefined;
  // Use Response to read bytes: works across browsers, jsdom, and Node, unlike
  // Blob.prototype.arrayBuffer which jsdom does not implement.
  const bytes = await new Response(blob).arrayBuffer();
  return { bytes, type: blob.type };
}

function fromStoredBlob(stored: StoredBlob | undefined): Blob | undefined {
  if (!stored) return undefined;
  return new Blob([stored.bytes], { type: stored.type });
}

/** Generate a unique id, preferring the platform UUID when available. */
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB implementation of {@link MomentusStore} for the browser PWA.
 *
 * Blobs are persisted as raw bytes + MIME type (see {@link StoredBlob}) and
 * rehydrated to Blob on read, so callers always see the Blob contract and the
 * data round-trips reliably across engines and maps to SQLite BLOBs natively.
 * Vectors are stored as number[] and rehydrated to Float32Array on read.
 */
export class IndexedDbStore implements MomentusStore {
  private readonly dbName: string;
  private dbPromise?: Promise<IDBDatabase>;

  constructor(dbName = "momentus") {
    this.dbName = dbName;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
            const entries = db.createObjectStore(STORE_ENTRIES, {
              keyPath: "id",
            });
            entries.createIndex("createdAt", "createdAt");
            entries.createIndex("dayKey", "dayKey");
          }
          if (!db.objectStoreNames.contains(STORE_VECTORS)) {
            db.createObjectStore(STORE_VECTORS, { keyPath: "entryId" });
          }
          if (!db.objectStoreNames.contains(STORE_CHAT)) {
            const chat = db.createObjectStore(STORE_CHAT, { keyPath: "id" });
            chat.createIndex("createdAt", "createdAt");
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private async tx(
    storeName: string,
    mode: IDBTransactionMode,
  ): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  // --- Entries ---

  async createEntry(input: NewEntry): Promise<Entry> {
    const createdAt = input.createdAt ?? Date.now();
    const entry: Entry = {
      id: input.id ?? newId(),
      createdAt,
      modality: input.modality,
      textContent: input.textContent,
      transcriptPending: input.transcriptPending,
      audioBlob: input.audioBlob,
      photoBlob: input.photoBlob,
      lat: input.lat,
      lng: input.lng,
      dayKey: input.dayKey ?? dayKeyOf(createdAt),
      // Sync defaults (M2): modified = created; not deleted; queued locally.
      updatedAt: input.updatedAt ?? createdAt,
      deleted: input.deleted ?? false,
      audioUrl: input.audioUrl,
      photoUrl: input.photoUrl,
      syncState: input.syncState ?? "local",
    };
    const stored: StoredEntry = {
      ...entry,
      audioBlob: await toStoredBlob(entry.audioBlob),
      photoBlob: await toStoredBlob(entry.photoBlob),
    };
    const store = await this.tx(STORE_ENTRIES, "readwrite");
    await promisifyRequest(store.put(stored));
    return entry;
  }

  private hydrate(stored: StoredEntry | undefined): Entry | undefined {
    if (!stored) return undefined;
    return {
      ...stored,
      audioBlob: fromStoredBlob(stored.audioBlob),
      photoBlob: fromStoredBlob(stored.photoBlob),
    };
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    const store = await this.tx(STORE_ENTRIES, "readonly");
    const stored = (await promisifyRequest(store.get(id))) as
      | StoredEntry
      | undefined;
    return this.hydrate(stored);
  }

  async listEntries(): Promise<Entry[]> {
    const store = await this.tx(STORE_ENTRIES, "readonly");
    const all = (await promisifyRequest(store.getAll())) as StoredEntry[];
    return all
      .filter((s) => !s.deleted) // hide tombstones from the UI (FR11/FR30)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => this.hydrate(s)!);
  }

  async listEntriesForSync(): Promise<Entry[]> {
    const store = await this.tx(STORE_ENTRIES, "readonly");
    const all = (await promisifyRequest(store.getAll())) as StoredEntry[];
    return all.map((s) => this.hydrate(s)!);
  }

  async updateEntry(
    id: string,
    patch: Partial<Entry>,
  ): Promise<Entry | undefined> {
    const current = await this.getEntry(id);
    if (!current) return undefined;
    const currentUpdatedAt = current.updatedAt ?? current.createdAt;
    // Monotonic LWW key: a mutation must advance updatedAt strictly past the
    // current value. Otherwise a same-millisecond create→update/delete (common
    // on fast devices) produces an equal timestamp that the server's strict-'>'
    // LWW check rejects, so the change silently never syncs. Sync-internal
    // writes that intend to KEEP the key (e.g. marking synced) pass the current
    // updatedAt explicitly and are preserved; only a would-be regression or tie
    // on a real content change is bumped.
    const requested = patch.updatedAt;
    let nextUpdatedAt: number;
    if (requested === undefined) {
      nextUpdatedAt = Math.max(Date.now(), currentUpdatedAt + 1);
    } else if (requested === currentUpdatedAt) {
      // Explicitly re-asserting the same key (idempotent sync write): keep it.
      nextUpdatedAt = requested;
    } else {
      // Never let the key move backwards.
      nextUpdatedAt = Math.max(requested, currentUpdatedAt);
    }
    const merged: Entry = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: nextUpdatedAt,
    };
    const stored: StoredEntry = {
      ...merged,
      audioBlob: await toStoredBlob(merged.audioBlob),
      photoBlob: await toStoredBlob(merged.photoBlob),
    };
    const store = await this.tx(STORE_ENTRIES, "readwrite");
    await promisifyRequest(store.put(stored));
    return merged;
  }

  async softDeleteEntry(id: string): Promise<void> {
    // Omit updatedAt so updateEntry's monotonic rule bumps it strictly past the
    // current value — a tombstone created in the same ms as the entry still
    // wins LWW (strict '>') on the server.
    await this.updateEntry(id, {
      deleted: true,
      syncState: "local",
    });
  }

  async deleteEntry(id: string): Promise<void> {
    const store = await this.tx(STORE_ENTRIES, "readwrite");
    await promisifyRequest(store.delete(id));
  }

  async countEntriesForDay(dayKey: string): Promise<number> {
    const store = await this.tx(STORE_ENTRIES, "readonly");
    const all = (await promisifyRequest(store.getAll())) as StoredEntry[];
    // Count non-deleted entries for the day (FR6/FR32); the dayKey index can't
    // express the !deleted predicate, so filter in memory (≤5/day scale).
    return all.filter((s) => s.dayKey === dayKey && !s.deleted).length;
  }

  // --- Vectors ---

  async saveVector(entryId: string, vector: Float32Array): Promise<void> {
    const store = await this.tx(STORE_VECTORS, "readwrite");
    await promisifyRequest(store.put({ entryId, vector: Array.from(vector) }));
  }

  async getVector(entryId: string): Promise<Float32Array | undefined> {
    const store = await this.tx(STORE_VECTORS, "readonly");
    const row = (await promisifyRequest(store.get(entryId))) as
      | { entryId: string; vector: number[] }
      | undefined;
    return row ? Float32Array.from(row.vector) : undefined;
  }

  async listVectors(): Promise<{ entryId: string; vector: Float32Array }[]> {
    const store = await this.tx(STORE_VECTORS, "readonly");
    const rows = (await promisifyRequest(store.getAll())) as {
      entryId: string;
      vector: number[];
    }[];
    return rows.map((r) => ({
      entryId: r.entryId,
      vector: Float32Array.from(r.vector),
    }));
  }

  // --- Chat ---

  async appendChatMessage(input: NewChatMessage): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: input.id ?? newId(),
      role: input.role,
      content: input.content,
      createdAt: input.createdAt ?? Date.now(),
    };
    const store = await this.tx(STORE_CHAT, "readwrite");
    await promisifyRequest(store.put(message));
    return message;
  }

  async listChatMessages(): Promise<ChatMessage[]> {
    const store = await this.tx(STORE_CHAT, "readonly");
    const all = (await promisifyRequest(store.getAll())) as ChatMessage[];
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async clearChat(): Promise<void> {
    const store = await this.tx(STORE_CHAT, "readwrite");
    await promisifyRequest(store.clear());
  }
}
