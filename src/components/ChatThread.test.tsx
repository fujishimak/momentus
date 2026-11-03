import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { IndexedDbStore, setStore } from "@/lib/db";
import { setEmbedder, type Embedder } from "@/lib/ai/embeddings";
import { ChatThread } from "./ChatThread";

const fallbackEmbedder: Embedder = {
  isAvailable: () => false,
  async embed() {
    throw new Error("unavailable");
  },
};

let n = 0;
async function seed() {
  n += 1;
  const store = new IndexedDbStore(`chat-thread-test-${n}`);
  setStore(store);
  setEmbedder(fallbackEmbedder);
  await store.createEntry({
    modality: "text",
    textContent: "grateful for my family",
    transcriptPending: false,
    createdAt: Date.now(),
  });
  return store;
}

describe("ChatThread (design §3.4)", () => {
  beforeEach(async () => {
    await seed();
  });

  it("renders the input and info copy", () => {
    render(<ChatThread />);
    expect(screen.getByPlaceholderText(/ask me anything/i)).toBeInTheDocument();
  });

  it("shows a user bubble and an assistant answer after sending", async () => {
    const user = userEvent.setup();
    render(<ChatThread />);
    await user.type(screen.getByPlaceholderText(/ask me anything/i), "family?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("family?")).toBeInTheDocument();
    // Extractive answer stitches the matching entry.
    expect(
      await screen.findByText(/grateful for my family/i),
    ).toBeInTheDocument();
  });

  it("persists the conversation to the store (single thread)", async () => {
    const store = new IndexedDbStore(`chat-thread-persist`);
    setStore(store);
    setEmbedder(fallbackEmbedder);
    await store.createEntry({
      modality: "text",
      textContent: "ran a marathon",
      transcriptPending: false,
    });

    const user = userEvent.setup();
    const { unmount } = render(<ChatThread />);
    await user.type(
      screen.getByPlaceholderText(/ask me anything/i),
      "marathon",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText(/ran a marathon/i);

    const messages = await store.listChatMessages();
    expect(messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    expect(messages[0].role).toBe("user");

    // Remount → history is reloaded (persistent thread).
    unmount();
    render(<ChatThread />);
    expect(await screen.findByText("marathon")).toBeInTheDocument();
  });

  it("does not send an empty message", async () => {
    const user = userEvent.setup();
    render(<ChatThread />);
    await user.click(screen.getByRole("button", { name: /send/i }));
    const store = (await import("@/lib/db")).getStore();
    expect(await store.listChatMessages()).toHaveLength(0);
  });
});
