import type { Entry } from "@/lib/db";
import { formatEntryTimestamp } from "@/lib/entries/view";

/**
 * Summarizer seam (design §5, R1). The chat answer is produced from a grounded
 * prompt built out of retrieved entries. Two implementations:
 *  - {@link ExtractiveSummarizer}: deterministic, no model — the day-one default
 *    and the fallback when the native model is unavailable.
 *  - a native Apple Foundation Models summarizer (Capacitor plugin, iOS 26.7.1),
 *    injected at runtime on device — NOT importable in the browser/CI.
 */
export interface Summarizer {
  summarise(prompt: string): Promise<string>;
  isAvailable(): boolean;
}

const GROUNDING_INSTRUCTION =
  "You are Momentus. Answer the user's question using ONLY the journal entries " +
  "below. If the entries do not contain the answer, say so. Do not invent events.";

/**
 * Build a retrieval-grounded prompt from the question and the retrieved entries
 * (RAG, design §5). Includes only the provided entries so nothing outside the
 * retrieval set can leak into the answer.
 */
export function buildPrompt(question: string, entries: Entry[]): string {
  const entriesBlock =
    entries.length === 0
      ? "(no matching entries)"
      : entries
          .map((e, i) => {
            const when = formatEntryTimestamp(e.createdAt);
            const body =
              e.textContent.trim() !== ""
                ? e.textContent.trim()
                : "(audio entry, no transcript yet)";
            return `Entry ${i + 1} — ${when}:\n${body}`;
          })
          .join("\n\n");

  return [
    GROUNDING_INSTRUCTION,
    "",
    "Journal entries:",
    entriesBlock,
    "",
    `Question: ${question}`,
    "Answer:",
  ].join("\n");
}

/** Extract the entry bodies back out of a prompt built by {@link buildPrompt}. */
function extractEntryBodies(prompt: string): string[] {
  const bodies: string[] = [];
  const lines = prompt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^Entry \d+ — /.test(lines[i])) {
      // The body is the following line(s) until a blank line.
      const body: string[] = [];
      for (let j = i + 1; j < lines.length && lines[j].trim() !== ""; j++) {
        body.push(lines[j]);
      }
      bodies.push(body.join(" "));
    }
  }
  return bodies;
}

/**
 * Deterministic, model-free summarizer (R1 fallback / day-one default). Stitches
 * the retrieved entry snippets into a short readable answer. Never fails.
 */
export class ExtractiveSummarizer implements Summarizer {
  isAvailable(): boolean {
    return true;
  }

  async summarise(prompt: string): Promise<string> {
    const bodies = extractEntryBodies(prompt);
    if (bodies.length === 0) {
      return "I couldn't find any entries that match your question.";
    }
    const bullets = bodies.map((b) => `• ${b}`).join("\n");
    return `Here's what you recorded:\n${bullets}`;
  }
}

/**
 * Choose the summarizer to use (R1): the native one when available, otherwise
 * the extractive fallback. With no native summarizer (browser/CI), always
 * extractive.
 */
export function resolveSummarizer(native?: Summarizer): Summarizer {
  if (native && native.isAvailable()) return native;
  return new ExtractiveSummarizer();
}
