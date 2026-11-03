import { describe, it, expect } from "vitest";
import {
  formatEntryTimestamp,
  entryPreview,
  filterEntries,
  type EntryFilter,
} from "./view";
import type { Entry } from "@/lib/db";

function entry(partial: Partial<Entry>): Entry {
  return {
    id: partial.id ?? "id",
    createdAt: partial.createdAt ?? Date.now(),
    modality: partial.modality ?? "text",
    textContent: partial.textContent ?? "",
    transcriptPending: partial.transcriptPending ?? false,
    dayKey: partial.dayKey ?? "2026-11-02",
    ...partial,
  };
}

describe("formatEntryTimestamp (design §3.3)", () => {
  it("formats as 'MMM D, YYYY · h:mm AM/PM'", () => {
    const ts = new Date(2026, 8, 23, 20, 15).getTime(); // 23 Sep 2026, 8:15 PM
    const out = formatEntryTimestamp(ts);
    expect(out).toMatch(/Sep 23, 2026/);
    expect(out).toMatch(/8:15/);
    expect(out).toMatch(/PM/i);
  });
});

describe("entryPreview", () => {
  it("returns the text content for a text entry", () => {
    expect(
      entryPreview(entry({ modality: "text", textContent: "Hi there" })),
    ).toBe("Hi there");
  });

  it("returns the transcript for an audio entry when available", () => {
    expect(
      entryPreview(
        entry({
          modality: "audio",
          textContent: "a transcript",
          transcriptPending: false,
        }),
      ),
    ).toBe("a transcript");
  });

  it("returns a placeholder for an audio entry awaiting transcription", () => {
    expect(
      entryPreview(
        entry({ modality: "audio", textContent: "", transcriptPending: true }),
      ),
    ).toMatch(/audio entry/i);
  });

  it("truncates long previews to a single line", () => {
    const long = "word ".repeat(60).trim();
    const preview = entryPreview(entry({ textContent: long }));
    expect(preview.length).toBeLessThanOrEqual(120);
  });
});

describe("filterEntries (design §3.3)", () => {
  const now = new Date(2026, 10, 2, 12, 0).getTime();
  const entries: Entry[] = [
    entry({
      id: "t1",
      modality: "text",
      textContent: "grateful family",
      createdAt: now,
    }),
    entry({
      id: "a1",
      modality: "audio",
      textContent: "great dinner",
      createdAt: now - 1000,
    }),
    entry({
      id: "t2",
      modality: "text",
      textContent: "project deadline",
      createdAt: new Date(2026, 9, 1, 9, 0).getTime(), // >7 days earlier
    }),
  ];

  function f(partial: Partial<EntryFilter>): EntryFilter {
    return { modality: "all", query: "", range: "all", ...partial };
  }

  it("returns all entries with the default filter", () => {
    expect(filterEntries(entries, f({}), now)).toHaveLength(3);
  });

  it("filters by modality", () => {
    expect(
      filterEntries(entries, f({ modality: "audio" }), now).map((e) => e.id),
    ).toEqual(["a1"]);
  });

  it("filters by substring query over text/transcript", () => {
    expect(
      filterEntries(entries, f({ query: "dinner" }), now).map((e) => e.id),
    ).toEqual(["a1"]);
  });

  it("filters by last-7-days range", () => {
    const ids = filterEntries(entries, f({ range: "7d" }), now).map(
      (e) => e.id,
    );
    expect(ids).toContain("t1");
    expect(ids).toContain("a1");
    expect(ids).not.toContain("t2");
  });

  it("is case-insensitive for the query", () => {
    expect(
      filterEntries(entries, f({ query: "GRATEFUL" }), now).map((e) => e.id),
    ).toEqual(["t1"]);
  });
});
