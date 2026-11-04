/**
 * Shared sync DTO (FR27-FR32). This is the wire shape exchanged between the
 * client sync engine and the server /api/entries routes. Binaries are
 * represented only as Vercel Blob pointers (url/type/size) — never bytes.
 */

export type Modality = "audio" | "text";

/** Blob pointer (FR28): a Vercel Blob URL plus its content type and size. */
export interface BlobPointer {
  url: string;
  type: string;
  size: number;
}

/** An entry as synced over the wire. Timestamps are epoch ms for a stable,
 * transport-friendly last-write-wins key (FR30). */
export interface SyncEntry {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  modality: Modality;
  textContent: string;
  transcriptPending: boolean;
  lat?: number | null;
  lng?: number | null;
  dayKey: string;
  audio?: BlobPointer | null;
  photo?: BlobPointer | null;
}

/** Pull response: entries changed since the requested cursor, plus the new
 * cursor for the next pull. Pagination (NFR13 cold-reconnect): a page carries
 * at most `limit` entries; `hasMore` indicates further pages remain, and
 * `cursorId` is the last entry id at the boundary so a keyset continuation is
 * exact even when several entries share the same `updatedAt` (ties). */
export interface PullResponse {
  entries: SyncEntry[];
  /** Max `updatedAt` at the page boundary (the next `since`). */
  cursor: number;
  /** Last entry id at the page boundary (the next `sinceId`), for tie-safe
   * keyset continuation. Absent on an empty page. */
  cursorId?: string;
  /** True when more pages remain after this one. */
  hasMore?: boolean;
}
