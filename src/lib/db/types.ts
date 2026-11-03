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
}

/** Fields a caller provides when creating an entry. Server-managed fields
 * (id, createdAt, dayKey) are derived by the store unless supplied. */
export type NewEntry = Omit<Entry, "id" | "createdAt" | "dayKey"> & {
  id?: string;
  createdAt?: number;
  dayKey?: string;
};

export type ChatRole = "user" | "assistant";

/** The stored authentication credential (FR17-FR19). Single row keyed by
 * username. Only a salted hash is persisted — never the plaintext. */
export interface AuthRecord {
  username: string;
  salt: string;
  passwordHash: string;
  /** True until the forced first-login password change is completed (FR19). */
  mustChange: boolean;
}

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
  /** Entries in reverse-chronological order (FR11). */
  listEntries(): Promise<Entry[]>;
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

  // --- Auth (FR16-FR20) ---
  getAuth(username: string): Promise<AuthRecord | undefined>;
  putAuth(record: AuthRecord): Promise<void>;
}
