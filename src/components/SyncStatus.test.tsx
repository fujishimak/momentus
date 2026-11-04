import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Mock the controller so the component test is deterministic (no real network).
const subscribers: ((s: string) => void)[] = [];
let syncCalls = 0;
vi.mock("@/lib/sync/controller", () => ({
  getSyncController: () => ({
    subscribe: (fn: (s: string) => void) => {
      subscribers.push(fn);
      fn("idle");
      return () => {};
    },
    sync: async () => {
      syncCalls += 1;
    },
  }),
}));

import { SyncStatus } from "./SyncStatus";

function emit(status: string) {
  act(() => {
    subscribers.forEach((fn) => fn(status));
  });
}

describe("SyncStatus (FR31 indicator)", () => {
  beforeEach(() => {
    subscribers.length = 0;
    syncCalls = 0;
  });

  it("renders an idle (synced) state by default", () => {
    render(<SyncStatus />);
    expect(screen.getByRole("status")).toHaveTextContent(/synced|up to date/i);
  });

  it("shows a syncing state", () => {
    render(<SyncStatus />);
    emit("syncing");
    expect(screen.getByRole("status")).toHaveTextContent(/syncing/i);
  });

  it("stays quiet inline when offline (the global OfflineIndicator owns it)", () => {
    render(<SyncStatus />);
    emit("offline");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("triggers a sync on mount", () => {
    render(<SyncStatus />);
    expect(syncCalls).toBeGreaterThanOrEqual(1);
  });
});
