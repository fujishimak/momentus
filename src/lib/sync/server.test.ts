// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  toSyncEntry,
  shouldApplyIncoming,
  countsTowardDailyCap,
  MAX_ENTRIES_PER_DAY,
  DEFAULT_PULL_LIMIT,
  clampPullLimit,
  buildPullPage,
  type EntryRow,
} from "./server";
import type { SyncEntry } from "./types";

function row(p: Partial<EntryRow>): EntryRow {
  return {
    id: "e1",
    userId: "u1",
    createdAt: new Date(1_000),
    updatedAt: new Date(2_000),
    deleted: false,
    modality: "text",
    textContent: "hi",
    transcriptPending: false,
    lat: null,
    lng: null,
    dayKey: "2026-11-03",
    audioUrl: null,
    audioType: null,
    audioSize: null,
    photoUrl: null,
    photoType: null,
    photoSize: null,
    ...p,
  };
}

describe("toSyncEntry (row → wire)", () => {
  it("maps epoch-ms timestamps and folds blob columns into pointers", () => {
    const s = toSyncEntry(
      row({
        createdAt: new Date(1_000),
        updatedAt: new Date(2_000),
        audioUrl: "https://blob/a",
        audioType: "audio/webm",
        audioSize: 123,
      }),
    );
    expect(s.createdAt).toBe(1_000);
    expect(s.updatedAt).toBe(2_000);
    expect(s.audio).toEqual({
      url: "https://blob/a",
      type: "audio/webm",
      size: 123,
    });
    expect(s.photo).toBeNull();
  });
});

describe("shouldApplyIncoming (LWW, FR30)", () => {
  const incoming: SyncEntry = {
    id: "e1",
    createdAt: 1000,
    updatedAt: 5000,
    deleted: false,
    modality: "text",
    textContent: "newer",
    transcriptPending: false,
    dayKey: "2026-11-03",
  };

  it("applies when no existing row", () => {
    expect(shouldApplyIncoming(incoming, null)).toBe(true);
  });

  it("applies when incoming is strictly newer", () => {
    expect(
      shouldApplyIncoming(incoming, row({ updatedAt: new Date(4000) })),
    ).toBe(true);
  });

  it("rejects when incoming is older (server wins)", () => {
    expect(
      shouldApplyIncoming(incoming, row({ updatedAt: new Date(6000) })),
    ).toBe(false);
  });

  it("rejects an equal timestamp (idempotent; server keeps its copy)", () => {
    expect(
      shouldApplyIncoming(incoming, row({ updatedAt: new Date(5000) })),
    ).toBe(false);
  });
});

describe("countsTowardDailyCap / 5-per-day (FR32)", () => {
  it("counts only non-deleted entries", () => {
    expect(countsTowardDailyCap(row({ deleted: false }))).toBe(true);
    expect(countsTowardDailyCap(row({ deleted: true }))).toBe(false);
  });

  it("exposes the cap constant as 5", () => {
    expect(MAX_ENTRIES_PER_DAY).toBe(5);
  });
});

/** Build a SyncEntry with the given updatedAt/id for pagination tests. */
function wire(id: string, updatedAt: number): SyncEntry {
  return {
    id,
    createdAt: updatedAt,
    updatedAt,
    deleted: false,
    modality: "text",
    textContent: id,
    transcriptPending: false,
    dayKey: "2026-11-03",
  };
}

describe("pull pagination (NFR13 cold-reconnect)", () => {
  it("clampPullLimit defaults and bounds the page size", () => {
    expect(clampPullLimit(undefined)).toBe(DEFAULT_PULL_LIMIT);
    expect(clampPullLimit(0)).toBe(DEFAULT_PULL_LIMIT);
    expect(clampPullLimit(-5)).toBe(DEFAULT_PULL_LIMIT);
    expect(clampPullLimit(10)).toBe(10);
    // Upper bound guards against an unbounded page.
    expect(clampPullLimit(100_000)).toBeLessThanOrEqual(1000);
  });

  it("returns a full page with hasMore=true and a tie-safe cursor when more remain", () => {
    // limit=2; caller fetched limit+1=3 rows to detect the extra.
    const fetched = [wire("a", 1000), wire("b", 2000), wire("c", 2000)];
    const page = buildPullPage(fetched, 2, 0);
    expect(page.entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(page.hasMore).toBe(true);
    // Boundary is the LAST returned entry (b@2000), so a tied sibling (c@2000)
    // is not skipped on the next page.
    expect(page.cursor).toBe(2000);
    expect(page.cursorId).toBe("b");
  });

  it("returns the final (short) page with hasMore=false", () => {
    const fetched = [wire("a", 1000), wire("b", 2000)];
    const page = buildPullPage(fetched, 5, 0);
    expect(page.entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(page.hasMore).toBe(false);
    expect(page.cursor).toBe(2000);
    expect(page.cursorId).toBe("b");
  });

  it("returns an empty page (nothing new) without advancing the cursor", () => {
    const page = buildPullPage([], 5, 4321);
    expect(page.entries).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.cursor).toBe(4321);
    expect(page.cursorId).toBeUndefined();
  });
});
