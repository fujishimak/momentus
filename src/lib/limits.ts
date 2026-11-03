/**
 * Client-side limit enforcement (FR3, FR6) and shared capture constants.
 * Pure functions — no I/O — so they are trivially testable and reusable by
 * both the browser and native paths.
 */

/** Maximum words in a text entry (FR3). */
export const MAX_WORDS = 150;
/** Maximum entries per local calendar day (FR6). */
export const MAX_ENTRIES_PER_DAY = 5;
/** Maximum audio recording length in seconds (FR2). */
export const MAX_AUDIO_SECONDS = 60;

/** Count whitespace-delimited words. Empty/whitespace-only ⇒ 0. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** True when the text is within the 150-word limit (FR3). */
export function isWithinWordLimit(text: string): boolean {
  return countWords(text) <= MAX_WORDS;
}

/** Clamp text to the first {@link MAX_WORDS} words, preserving order. */
export function clampToWordLimit(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const words = trimmed.split(/\s+/);
  if (words.length <= MAX_WORDS) return trimmed;
  return words.slice(0, MAX_WORDS).join(" ");
}

/** Local calendar day key 'YYYY-MM-DD' for a given epoch-ms timestamp (FR6). */
export function dayKeyOf(epochMs: number): string {
  const d = new Date(epochMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whether another entry may be added given today's existing count (FR6). */
export function canAddEntry(existingCountToday: number): boolean {
  return existingCountToday < MAX_ENTRIES_PER_DAY;
}
