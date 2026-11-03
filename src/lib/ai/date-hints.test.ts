import { describe, it, expect } from "vitest";
import { parseDateHint } from "./date-hints";

// Fixed "now": Mon 2 Nov 2026, local.
const NOW = new Date(2026, 10, 2, 12, 0).getTime();

function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

describe("parseDateHint", () => {
  it("returns null when there is no date hint", () => {
    expect(parseDateHint("what makes me happy", NOW)).toBeNull();
  });

  it("parses an explicit year: 'in 2022'", () => {
    const range = parseDateHint("what important things happened in 2022", NOW);
    expect(range).not.toBeNull();
    expect(ymd(range!.start)).toBe("2022-01-01");
    expect(ymd(range!.end)).toBe("2022-12-31");
  });

  it("parses 'X years ago' as that calendar year", () => {
    const range = parseDateHint("what did I record 1 year ago", NOW);
    // 1 year before 2026 → 2025.
    expect(range).not.toBeNull();
    expect(ymd(range!.start)).toBe("2025-01-01");
    expect(ymd(range!.end)).toBe("2025-12-31");
  });

  it("parses 'last week' as the previous 7 days", () => {
    const range = parseDateHint("what happened last week", NOW);
    expect(range).not.toBeNull();
    // end is now; start is ~7 days earlier
    expect(range!.end).toBe(NOW);
    expect(NOW - range!.start).toBeGreaterThanOrEqual(6 * 24 * 60 * 60 * 1000);
    expect(NOW - range!.start).toBeLessThanOrEqual(8 * 24 * 60 * 60 * 1000);
  });

  it("parses 'yesterday' as the prior calendar day", () => {
    const range = parseDateHint("what did I do yesterday", NOW);
    expect(range).not.toBeNull();
    expect(ymd(range!.start)).toBe("2026-11-01");
    expect(ymd(range!.end)).toBe("2026-11-01");
  });

  it("ignores years outside a plausible range", () => {
    // 1800 and 3000 are not journal years.
    expect(parseDateHint("the year 1800 was historic", NOW)).toBeNull();
  });
});
