import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntryCard } from "./EntryCard";
import type { Entry } from "@/lib/db";

function entry(partial: Partial<Entry>): Entry {
  return {
    id: "e1",
    createdAt: new Date(2026, 8, 23, 20, 15).getTime(),
    modality: "text",
    textContent: "Feeling grateful for my family",
    transcriptPending: false,
    dayKey: "2026-09-23",
    ...partial,
  };
}

describe("EntryCard (design §3.3)", () => {
  it("renders the preview and formatted timestamp", () => {
    render(<EntryCard entry={entry({})} />);
    expect(screen.getByText(/feeling grateful/i)).toBeInTheDocument();
    expect(screen.getByText(/Sep 23, 2026/)).toBeInTheDocument();
  });

  it("links to the entry detail route", () => {
    render(<EntryCard entry={entry({ id: "abc" })} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/entries/detail?id=abc",
    );
  });

  it("labels audio vs text modality for assistive tech", () => {
    render(
      <EntryCard
        entry={entry({ modality: "audio", transcriptPending: true })}
      />,
    );
    expect(screen.getByText(/audio entry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/audio/i)).toBeInTheDocument();
  });
});
