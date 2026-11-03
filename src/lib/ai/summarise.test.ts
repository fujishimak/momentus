import { describe, it, expect, vi } from "vitest";
import {
  buildPrompt,
  ExtractiveSummarizer,
  resolveSummarizer,
  type Summarizer,
} from "./summarise";
import type { Entry } from "@/lib/db";

function entry(partial: Partial<Entry>): Entry {
  return {
    id: partial.id ?? "e",
    createdAt: partial.createdAt ?? new Date(2025, 8, 24, 10, 0).getTime(),
    modality: partial.modality ?? "text",
    textContent: partial.textContent ?? "",
    transcriptPending: partial.transcriptPending ?? false,
    dayKey: partial.dayKey ?? "2025-09-24",
    ...partial,
  };
}

describe("buildPrompt (RAG grounding, design §5)", () => {
  const entries = [
    entry({ id: "1", textContent: "Excited to start AWS certification" }),
    entry({ id: "2", textContent: "Family trip to Banff" }),
  ];

  it("includes the question and each retrieved entry", () => {
    const prompt = buildPrompt("what did I plan?", entries);
    expect(prompt).toMatch(/what did I plan\?/);
    expect(prompt).toMatch(/AWS certification/);
    expect(prompt).toMatch(/Banff/);
  });

  it("includes only the retrieved entries (no leakage)", () => {
    const prompt = buildPrompt("q", [entries[0]]);
    expect(prompt).toMatch(/AWS certification/);
    expect(prompt).not.toMatch(/Banff/);
  });

  it("states the grounding instruction (answer only from entries)", () => {
    const prompt = buildPrompt("q", entries);
    expect(prompt.toLowerCase()).toMatch(/only.*entries|based on .*entries/);
  });
});

describe("ExtractiveSummarizer (R1 fallback)", () => {
  it("stitches retrieved entry snippets into an answer", async () => {
    const s = new ExtractiveSummarizer();
    const out = await s.summarise(
      buildPrompt("what happened?", [
        entry({ textContent: "Ran a 10k race" }),
        entry({ textContent: "Cooked dinner for friends" }),
      ]),
    );
    expect(out).toMatch(/10k race/);
    expect(out).toMatch(/dinner for friends/);
  });

  it("is always available", () => {
    expect(new ExtractiveSummarizer().isAvailable()).toBe(true);
  });

  it("handles an empty retrieval gracefully", async () => {
    const s = new ExtractiveSummarizer();
    const out = await s.summarise(buildPrompt("q", []));
    expect(out).toMatch(/couldn't find|no .*entries/i);
  });
});

describe("resolveSummarizer (R1 selection)", () => {
  it("uses the native summarizer when available", async () => {
    const native: Summarizer = {
      isAvailable: () => true,
      summarise: vi.fn().mockResolvedValue("native answer"),
    };
    const chosen = resolveSummarizer(native);
    expect(await chosen.summarise("prompt")).toBe("native answer");
    expect(native.summarise).toHaveBeenCalled();
  });

  it("falls back to extractive when native is unavailable", async () => {
    const native: Summarizer = {
      isAvailable: () => false,
      summarise: vi.fn(),
    };
    const chosen = resolveSummarizer(native);
    expect(chosen).toBeInstanceOf(ExtractiveSummarizer);
    expect(native.summarise).not.toHaveBeenCalled();
  });

  it("defaults to extractive when no native summarizer is provided", () => {
    expect(resolveSummarizer()).toBeInstanceOf(ExtractiveSummarizer);
  });
});
