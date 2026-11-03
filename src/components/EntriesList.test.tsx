import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { IndexedDbStore, setStore } from "@/lib/db";
import { EntriesList } from "./EntriesList";

let n = 0;
async function seedStore() {
  n += 1;
  const store = new IndexedDbStore(`entries-list-test-${n}`);
  setStore(store);
  await store.createEntry({
    modality: "text",
    textContent: "grateful for my family",
    transcriptPending: false,
    createdAt: Date.now(),
  });
  await store.createEntry({
    modality: "audio",
    textContent: "great dinner with the kids",
    transcriptPending: false,
    createdAt: Date.now() - 1000,
  });
  return store;
}

describe("EntriesList (design §3.3)", () => {
  beforeEach(async () => {
    await seedStore();
  });

  it("renders stored entries", async () => {
    render(<EntriesList />);
    expect(
      await screen.findByText(/grateful for my family/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/great dinner/i)).toBeInTheDocument();
  });

  it("filters by the search query", async () => {
    const user = userEvent.setup();
    render(<EntriesList />);
    await screen.findByText(/grateful for my family/i);
    await user.type(screen.getByRole("searchbox"), "dinner");
    await waitFor(() => {
      expect(
        screen.queryByText(/grateful for my family/i),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/great dinner/i)).toBeInTheDocument();
  });

  it("filters by the Audio chip", async () => {
    const user = userEvent.setup();
    render(<EntriesList />);
    await screen.findByText(/great dinner/i);
    await user.click(screen.getByRole("button", { name: /^audio$/i }));
    await waitFor(() => {
      expect(
        screen.queryByText(/grateful for my family/i),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/great dinner/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no matches", async () => {
    const user = userEvent.setup();
    render(<EntriesList />);
    await screen.findByText(/grateful for my family/i);
    await user.type(screen.getByRole("searchbox"), "zzzznomatch");
    expect(await screen.findByText(/no entries/i)).toBeInTheDocument();
  });
});
