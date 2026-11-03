// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  toSyncEntry,
  shouldApplyIncoming,
  countsTowardDailyCap,
  MAX_ENTRIES_PER_DAY,
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
