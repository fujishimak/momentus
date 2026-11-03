import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { IndexedDbStore, setStore } from "@/lib/db";
import { EntryDetail } from "./EntryDetail";

beforeAll(() => {
  if (!("createObjectURL" in URL)) {
    // @ts-expect-error -- test stub
    URL.createObjectURL = vi.fn(() => "blob:mock");
    // @ts-expect-error -- test stub
    URL.revokeObjectURL = vi.fn();
  }
});

let n = 0;
async function freshStore() {
  n += 1;
  const store = new IndexedDbStore(`entry-detail-test-${n}`);
  setStore(store);
  return store;
}

describe("EntryDetail (design §3.6, FR15)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a text entry's full content and timestamp", async () => {
    const store = await freshStore();
    const e = await store.createEntry({
      modality: "text",
      textContent: "A full day of hiking",
      transcriptPending: false,
      createdAt: new Date(2026, 8, 23, 20, 15).getTime(),
    });
    render(<EntryDetail entryId={e.id} onDeleted={vi.fn()} />);
    expect(
      await screen.findByText(/a full day of hiking/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sep 23, 2026/)).toBeInTheDocument();
  });

  it("renders an audio player for an audio entry", async () => {
    const store = await freshStore();
    const e = await store.createEntry({
      modality: "audio",
      textContent: "",
      transcriptPending: true,
      audioBlob: new Blob([new Uint8Array([1, 2])], { type: "audio/webm" }),
      createdAt: Date.now(),
    });
    render(<EntryDetail entryId={e.id} onDeleted={vi.fn()} />);
    expect(await screen.findByTestId("audio-player")).toBeInTheDocument();
  });

  it("shows location metadata when present", async () => {
    const store = await freshStore();
    const e = await store.createEntry({
      modality: "text",
      textContent: "located",
      transcriptPending: false,
      lat: 51.5074,
      lng: -0.1278,
      createdAt: Date.now(),
    });
    render(<EntryDetail entryId={e.id} onDeleted={vi.fn()} />);
    expect(await screen.findByText(/51\.5074/)).toBeInTheDocument();
    expect(screen.getByText(/-0\.1278/)).toBeInTheDocument();
  });

  it("deletes the entry and calls onDeleted", async () => {
    const store = await freshStore();
    const e = await store.createEntry({
      modality: "text",
      textContent: "to delete",
      transcriptPending: false,
    });
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<EntryDetail entryId={e.id} onDeleted={onDeleted} />);
    await screen.findByText(/to delete/i);
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(await store.getEntry(e.id)).toBeUndefined();
  });

  it("shows a not-found message for a missing entry", async () => {
    await freshStore();
    render(<EntryDetail entryId="does-not-exist" onDeleted={vi.fn()} />);
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});
