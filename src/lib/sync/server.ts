import type { SyncEntry, Modality, BlobPointer } from "./types";

/** Max entries per local calendar day, enforced server-side (FR32). */
export const MAX_ENTRIES_PER_DAY = 5;

/** The Prisma `Entry` row shape (subset used by the pure helpers). Declared
 * locally so these helpers stay unit-testable without importing Prisma. */
export interface EntryRow {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  modality: string;
  textContent: string;
  transcriptPending: boolean;
  lat: number | null;
  lng: number | null;
  dayKey: string;
  audioUrl: string | null;
  audioType: string | null;
  audioSize: number | null;
  photoUrl: string | null;
  photoType: string | null;
  photoSize: number | null;
}

function pointer(
  url: string | null,
  type: string | null,
  size: number | null,
): BlobPointer | null {
  if (!url) return null;
  return { url, type: type ?? "application/octet-stream", size: size ?? 0 };
}

/** Map a DB row to the wire DTO (epoch-ms timestamps, folded blob pointers). */
export function toSyncEntry(r: EntryRow): SyncEntry {
  return {
    id: r.id,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
    deleted: r.deleted,
    modality: r.modality as Modality,
    textContent: r.textContent,
    transcriptPending: r.transcriptPending,
    lat: r.lat,
    lng: r.lng,
    dayKey: r.dayKey,
    audio: pointer(r.audioUrl, r.audioType, r.audioSize),
    photo: pointer(r.photoUrl, r.photoType, r.photoSize),
  };
}

/** Columns to write for an incoming SyncEntry (unfolds pointers to columns). */
export function toEntryColumns(e: SyncEntry, userId: string) {
  return {
    id: e.id,
    userId,
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
    deleted: e.deleted,
    modality: e.modality,
    textContent: e.textContent,
    transcriptPending: e.transcriptPending,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    dayKey: e.dayKey,
    audioUrl: e.audio?.url ?? null,
    audioType: e.audio?.type ?? null,
    audioSize: e.audio?.size ?? null,
    photoUrl: e.photo?.url ?? null,
    photoType: e.photo?.type ?? null,
    photoSize: e.photo?.size ?? null,
  };
}

/**
 * Last-write-wins decision (FR30): apply the incoming entry only if there is no
 * existing row, or the incoming `updatedAt` is strictly newer. Equal timestamps
 * are rejected so repeated pushes are idempotent and the server keeps its copy.
 */
export function shouldApplyIncoming(
  incoming: SyncEntry,
  existing: EntryRow | null,
): boolean {
  if (!existing) return true;
  return incoming.updatedAt > existing.updatedAt.getTime();
}

/** Whether an entry counts toward the daily cap (non-deleted only, FR32). */
export function countsTowardDailyCap(r: EntryRow): boolean {
  return !r.deleted;
}
