import type { Entry, Modality } from "@/lib/db";

const PREVIEW_MAX = 120;

/** Format an entry timestamp as 'MMM D, YYYY · h:mm AM/PM' (design §3.3). */
export function formatEntryTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

/** One-line preview text for an entry card (design §3.3). */
export function entryPreview(entry: Entry): string {
  let base: string;
  if (entry.modality === "audio" && entry.transcriptPending) {
    base = "Audio entry";
  } else if (entry.textContent.trim() !== "") {
    base = entry.textContent.trim().replace(/\s+/g, " ");
  } else {
    base = entry.modality === "audio" ? "Audio entry" : "Untitled entry";
  }
  return base.length > PREVIEW_MAX
    ? `${base.slice(0, PREVIEW_MAX - 1)}…`
    : base;
}

export type ModalityFilter = "all" | Modality;
export type RangeFilter = "all" | "7d" | "30d";

export interface EntryFilter {
  modality: ModalityFilter;
  query: string;
  range: RangeFilter;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Filter entries by modality, a case-insensitive substring query over the
 * text/transcript, and a recency range (design §3.3). `now` is injectable for
 * deterministic tests. Semantic (embedding) search replaces the substring
 * query in Phase 7; this is the day-one fallback.
 */
export function filterEntries(
  entries: Entry[],
  filter: EntryFilter,
  now: number = Date.now(),
): Entry[] {
  const q = filter.query.trim().toLowerCase();
  const rangeMs =
    filter.range === "7d"
      ? 7 * DAY_MS
      : filter.range === "30d"
        ? 30 * DAY_MS
        : Infinity;

  return entries.filter((e) => {
    if (filter.modality !== "all" && e.modality !== filter.modality) {
      return false;
    }
    if (rangeMs !== Infinity && now - e.createdAt > rangeMs) {
      return false;
    }
    if (q !== "" && !e.textContent.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}
