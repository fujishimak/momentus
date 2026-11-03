/**
 * Lightweight natural-language date parsing for chat retrieval (design §3.4,
 * §5). Recognizes a few common temporal phrases so queries like "what did I
 * record 1 year ago" or "what happened in 2022" can be scoped to a date range.
 * Deterministic and `now`-injectable for testing. Not a full NLP date parser —
 * just the patterns the product's example prompts need.
 */

export interface DateRange {
  /** Inclusive start, epoch ms. */
  start: number;
  /** Inclusive end, epoch ms. */
  end: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfYear(year: number): number {
  return new Date(year, 0, 1, 0, 0, 0, 0).getTime();
}
function endOfYear(year: number): number {
  return new Date(year, 11, 31, 23, 59, 59, 999).getTime();
}
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
}
function endOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();
}

/**
 * Parse a date hint from free text. Returns a {@link DateRange} or `null` when
 * no temporal phrase is found (caller then searches without a date filter).
 */
export function parseDateHint(
  text: string,
  now: number = Date.now(),
): DateRange | null {
  const q = text.toLowerCase();
  const nowYear = new Date(now).getFullYear();

  // "yesterday"
  if (/\byesterday\b/.test(q)) {
    const y = now - DAY_MS;
    return { start: startOfDay(y), end: endOfDay(y) };
  }

  // "today"
  if (/\btoday\b/.test(q)) {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  // "last week" / "past week"
  if (/\b(last|past)\s+week\b/.test(q)) {
    return { start: now - 7 * DAY_MS, end: now };
  }

  // "last month" / "past month"
  if (/\b(last|past)\s+month\b/.test(q)) {
    return { start: now - 30 * DAY_MS, end: now };
  }

  // "N year(s) ago" / "N month(s) ago"
  const agoYear = q.match(/\b(\d+)\s+years?\s+ago\b/);
  if (agoYear) {
    const year = nowYear - parseInt(agoYear[1], 10);
    return { start: startOfYear(year), end: endOfYear(year) };
  }
  const agoMonth = q.match(/\b(\d+)\s+months?\s+ago\b/);
  if (agoMonth) {
    const months = parseInt(agoMonth[1], 10);
    const d = new Date(now);
    const target = new Date(d.getFullYear(), d.getMonth() - months, 1);
    const start = new Date(
      target.getFullYear(),
      target.getMonth(),
      1,
    ).getTime();
    const end = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).getTime();
    return { start, end };
  }

  // Explicit 4-digit year within a plausible journaling window.
  const yearMatch = q.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 2000 && year <= nowYear) {
      return { start: startOfYear(year), end: endOfYear(year) };
    }
  }

  return null;
}
