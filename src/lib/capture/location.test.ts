import { describe, it, expect, vi, afterEach } from "vitest";
import { getCurrentLocation } from "./location";

function mockGeolocation(
  impl: Partial<Geolocation> & {
    getCurrentPosition?: Geolocation["getCurrentPosition"];
  },
) {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: impl,
  });
}

describe("getCurrentLocation (FR8, non-blocking)", () => {
  afterEach(() => {
    // @ts-expect-error -- clean up the stubbed API.
    delete globalThis.navigator.geolocation;
    vi.restoreAllMocks();
  });

  it("resolves lat/lng when permission is granted", async () => {
    mockGeolocation({
      getCurrentPosition: (success) =>
        success({
          coords: { latitude: 51.5, longitude: -0.12 },
        } as GeolocationPosition),
    });
    const loc = await getCurrentLocation();
    expect(loc).toEqual({ lat: 51.5, lng: -0.12 });
  });

  it("resolves undefined when permission is denied (never blocks)", async () => {
    mockGeolocation({
      getCurrentPosition: (_success, error) =>
        error?.({ code: 1, message: "denied" } as GeolocationPositionError),
    });
    const loc = await getCurrentLocation();
    expect(loc).toBeUndefined();
  });

  it("resolves undefined when geolocation is unavailable", async () => {
    // No navigator.geolocation defined.
    const loc = await getCurrentLocation();
    expect(loc).toBeUndefined();
  });

  it("resolves undefined on timeout rather than hanging", async () => {
    vi.useFakeTimers();
    mockGeolocation({
      // Never calls success or error.
      getCurrentPosition: () => {},
    });
    const promise = getCurrentLocation({ timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
