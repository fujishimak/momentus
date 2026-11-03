import type { Entry, MomentusStore } from "@/lib/db";
import {
  MAX_ENTRIES_PER_DAY,
  canAddEntry,
  dayKeyOf,
  isWithinWordLimit,
} from "@/lib/limits";

/** Thrown when saving would exceed the 5-entries-per-day cap (FR6). */
export class DailyLimitError extends Error {
  constructor() {
    super(
      `You've reached the limit of ${MAX_ENTRIES_PER_DAY} entries for today. Come back tomorrow to add more.`,
    );
    this.name = "DailyLimitError";
  }
}

/** Thrown when text exceeds the 150-word cap (FR3). */
export class WordLimitError extends Error {
  constructor() {
    super("Your entry is over the 150-word limit.");
    this.name = "WordLimitError";
  }
}

/** Thrown when the entry has no content. */
export class EmptyEntryError extends Error {
  constructor() {
    super("Your entry is empty.");
    this.name = "EmptyEntryError";
  }
}

/** Thrown when an audio entry has no recorded audio. */
export class AudioEntryError extends Error {
  constructor() {
    super("There's no audio to save.");
    this.name = "AudioEntryError";
  }
}

/** Shared 5/day guard (FR6): throws if today's cap is already reached. */
async function assertDailyCapAvailable(
  store: MomentusStore,
  dayKey: string,
): Promise<void> {
  const countToday = await store.countEntriesForDay(dayKey);
  if (!canAddEntry(countToday)) throw new DailyLimitError();
}

export interface SaveTextEntryInput {
  text: string;
  photo?: Blob;
  lat?: number;
  lng?: number;
  /** Timestamp override for deterministic testing. Defaults to now. */
  now?: number;
}

/**
 * Validate and persist a text entry (FR1, FR3, FR5-FR8).
 *
 * The daily-cap check and the insert are performed as a count-then-insert
 * guard so the 6th same-day entry is rejected (FR6). For the single local user
 * this is effectively atomic; the native backend will wrap it in one
 * transaction (task T2.5).
 */
export async function saveTextEntry(
  store: MomentusStore,
  input: SaveTextEntryInput,
): Promise<Entry> {
  const text = input.text.trim();
  if (text === "") throw new EmptyEntryError();
  if (!isWithinWordLimit(text)) throw new WordLimitError();

  const now = input.now ?? Date.now();
  const dayKey = dayKeyOf(now);

  await assertDailyCapAvailable(store, dayKey);

  return store.createEntry({
    modality: "text",
    textContent: text,
    transcriptPending: false,
    photoBlob: input.photo,
    lat: input.lat,
    lng: input.lng,
    createdAt: now,
    dayKey,
  });
}

export interface SaveAudioEntryInput {
  audio: Blob;
  photo?: Blob;
  lat?: number;
  lng?: number;
  /** Timestamp override for deterministic testing. Defaults to now. */
  now?: number;
}

/**
 * Validate and persist an audio entry (FR1, FR2, FR5-FR8). The transcript is
 * left empty with transcriptPending=true for later on-device transcription
 * (FR4, Phase 10); the 5/day cap is shared with text entries (FR6).
 */
export async function saveAudioEntry(
  store: MomentusStore,
  input: SaveAudioEntryInput,
): Promise<Entry> {
  if (!input.audio || input.audio.size === 0) throw new AudioEntryError();

  const now = input.now ?? Date.now();
  const dayKey = dayKeyOf(now);

  await assertDailyCapAvailable(store, dayKey);

  return store.createEntry({
    modality: "audio",
    textContent: "",
    transcriptPending: true,
    audioBlob: input.audio,
    photoBlob: input.photo,
    lat: input.lat,
    lng: input.lng,
    createdAt: now,
    dayKey,
  });
}
