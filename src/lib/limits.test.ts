import { describe, it, expect } from "vitest";
import {
  MAX_ENTRIES_PER_DAY,
  MAX_WORDS,
  MAX_AUDIO_SECONDS,
  countWords,
  isWithinWordLimit,
  clampToWordLimit,
  dayKeyOf,
  canAddEntry,
} from "./limits";

describe("word counting (FR3)", () => {
  it("counts words separated by any whitespace", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  spaced   out \n words ")).toBe(3);
  });

  it("treats an empty or whitespace-only string as zero words", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });

  it("enforces the 150-word limit", () => {
    const exactly150 = Array.from({ length: 150 }, () => "w").join(" ");
    const over = Array.from({ length: 151 }, () => "w").join(" ");
    expect(isWithinWordLimit(exactly150)).toBe(true);
    expect(isWithinWordLimit(over)).toBe(false);
  });

  it("clamps text to the first 150 words", () => {
    const over = Array.from({ length: 160 }, (_, i) => `w${i}`).join(" ");
    const clamped = clampToWordLimit(over);
    expect(countWords(clamped)).toBe(MAX_WORDS);
    expect(clamped.startsWith("w0 w1")).toBe(true);
    expect(clamped.endsWith("w149")).toBe(true);
  });
});

describe("constants", () => {
  it("matches the committed requirements", () => {
    expect(MAX_WORDS).toBe(150);
    expect(MAX_ENTRIES_PER_DAY).toBe(5);
    expect(MAX_AUDIO_SECONDS).toBe(60);
  });
});

describe("dayKeyOf (FR6/FR7)", () => {
  it("formats a timestamp as local YYYY-MM-DD", () => {
    // Construct a local date explicitly to avoid TZ ambiguity.
    const d = new Date(2026, 10, 2, 13, 30); // 2 Nov 2026, local
    expect(dayKeyOf(d.getTime())).toBe("2026-11-02");
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5, 9, 0); // 5 Jan 2026
    expect(dayKeyOf(d.getTime())).toBe("2026-01-05");
  });
});

describe("canAddEntry (FR6)", () => {
  it("allows entries below the daily cap", () => {
    expect(canAddEntry(0)).toBe(true);
    expect(canAddEntry(4)).toBe(true);
  });

  it("blocks at and beyond the daily cap", () => {
    expect(canAddEntry(5)).toBe(false);
    expect(canAddEntry(6)).toBe(false);
  });
});
