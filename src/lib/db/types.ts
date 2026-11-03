/**
 * Backend-agnostic storage contract for Momentus.
 *
 * The browser PWA implements this over IndexedDB; the iOS/Capacitor build will
 * implement the same interface over Capacitor SQLite. UI and feature code
 * depends only on this interface, never on a concrete backend (design §6, R3).
 */

export type Modality = "audio" | "text";

/** A single journal entry. Media are stored as Blobs locally (FR5, FR9). */
export interface Entry {
  id: string;
  /** Epoch milliseconds (FR7). */
  createdAt: number;
  modality: Modality;
  /** Text entry body, or the audio transcript once available (FR3/FR4). */
  textContent: string;
  /** True while an audio entry awaits on-device transcription (R1). */
  transcriptPending: boolean;
  /** Raw audio for audio entries (FR2). */
  audioBlob?: Blob;
  /** Optional single photo (FR5). */
  photoBlob?: Blob;
  /** Location metadata, present only if permission was granted (FR8). */
  lat?: number;
  lng?: number;
  /** Local calendar day 'YYYY-MM-DD', used for the 5/day limit (FR6). */
  dayKey: string;

  // --- Sync fields (M2, FR27-FR31). Optional so pre-sync create paths and
  // tests remain valid; the store fills defaults on create. ---
  /** Last-modified epoch ms — the last-write-wins key (FR30). Defaults to
   * createdAt on first create. */
  updatedAt?: number;
  /** Soft-delete tombstone (FR30). */
  deleted?: boolean;
  /** Vercel Blob pointer for the audio, once uploaded (FR28/FR31). */
  audioUrl?: string;
  /** Vercel Blob pointer for the photo, once uploaded (FR28/FR31). */
  photoUrl?: string;
  /** Local sync state (FR31): queued locally, metadata synced w/ blob pending,
   * or fully synced. */
  syncState?: SyncState;
}

/** Local sync lifecycle for an entry (FR31). */
export type SyncState = "local" | "metaSynced-blobPending" | "synced";

/** Fields a caller provides when creating an entry. Server-managed fields
 * (id, createdAt, dayKey) are derived by the store unless supplied. */
export type NewEntry = Omit<Entry, "id" | "createdAt" | "dayKey"> & {
  id?: string;
  createdAt?: number;
  dayKey?: string;
};

export type ChatRole = "user" | "assistant";

/** One message in the single persistent chat thread (design §3.4). */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export type NewChatMessage = Omit<ChatMessage, "id" | "createdAt"> & {
  id?: string;
  createdAt?: number;
};

/**
 * The storage API. All methods are async so a native SQLite backend can satisfy
 * the same contract.
 */
export interface MomentusStore {
  // --- Entries ---
  createEntry(entry: NewEntry): Promise<Entry>;
  getEntry(id: string): Promise<Entry | undefined>;
  /** Entries in reverse-chronological order, excluding tombstones (FR11). */
  listEntries(): Promise<Entry[]>;
  /** All entries including tombstones — used by the sync push queue (FR29). */
  listEntriesForSync(): Promise<Entry[]>;
  /** Patch an existing entry (sets updatedAt unless provided). Used by sync
   * pulls and transcript backfill (FR29/FR30). */
  updateEntry(id: string, patch: Partial<Entry>): Promise<Entry | undefined>;
  /** Soft-delete: set the tombstone + bump updatedAt so it syncs (FR30). */
  softDeleteEntry(id: string): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  /** Count of entries whose dayKey equals the given local day (FR6). */
  countEntriesForDay(dayKey: string): Promise<number>;

  // --- Embedding vectors (FR9/FR12) ---
  saveVector(entryId: string, vector: Float32Array): Promise<void>;
  getVector(entryId: string): Promise<Float32Array | undefined>;
  listVectors(): Promise<{ entryId: string; vector: Float32Array }[]>;

  // --- Chat thread (design §3.4) ---
  appendChatMessage(message: NewChatMessage): Promise<ChatMessage>;
  listChatMessages(): Promise<ChatMessage[]>;
  clearChat(): Promise<void>;
}
