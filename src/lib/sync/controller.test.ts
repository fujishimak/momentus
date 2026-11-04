// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";

// The controller constructs a real SyncEngine over getStore() + HttpSyncServer.
// Stub the HTTP client so no network happens and the cycle is deterministic.
vi.mock("./client", () => ({
  HttpSyncServer: class {
    async uploadBlob() {
      return { url: "x", type: "application/octet-stream", size: 0 };
    }
    async push() {}
    async pull() {
      return { entries: [], cursor: 0 };
    }
  },
}));

import { getSyncController } from "./controller";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

describe("SyncController latency instrumentation (NFR13)", () => {
  beforeEach(() => {
    setOnline(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a numeric duration for a completed sync cycle", async () => {
    const controller = getSyncController();
    await controller.sync();
    const ms = controller.getLastSyncMs();
    expect(typeof ms).toBe("number");
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("notifies latency subscribers when a cycle completes", async () => {
    const controller = getSyncController();
    const seen: number[] = [];
    const unsub = controller.subscribeLatency((ms) => seen.push(ms));

    await controller.sync();

    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[seen.length - 1]).toBeGreaterThanOrEqual(0);
    unsub();
  });

  it("does not update the recorded duration when offline (cycle skipped)", async () => {
    const controller = getSyncController();
    await controller.sync(); // online: record a duration
    const before = controller.getLastSyncMs();
    expect(typeof before).toBe("number");

    setOnline(false);
    const seen: number[] = [];
    const unsub = controller.subscribeLatency((ms) => seen.push(ms));
    await controller.sync(); // offline: should not record/notify
    unsub();

    expect(seen).toHaveLength(0);
    expect(controller.getLastSyncMs()).toBe(before);
  });
});
