import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { OfflineIndicator } from "./OfflineIndicator";

/** Drive navigator.onLine deterministically. */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

function fireConnectivity(event: "online" | "offline") {
  act(() => {
    window.dispatchEvent(new Event(event));
  });
}

describe("OfflineIndicator (FR33 — disconnected state)", () => {
  beforeEach(() => {
    setOnline(true);
  });
  afterEach(() => {
    cleanup();
    setOnline(true);
    vi.restoreAllMocks();
  });

  it("renders nothing while online", () => {
    render(<OfflineIndicator />);
    expect(screen.queryByTestId("offline-indicator")).toBeNull();
  });

  it("appears when connectivity is lost (offline event)", () => {
    render(<OfflineIndicator />);
    setOnline(false);
    fireConnectivity("offline");
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
  });

  it("clears again when connectivity returns (online event)", () => {
    render(<OfflineIndicator />);
    setOnline(false);
    fireConnectivity("offline");
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();

    setOnline(true);
    fireConnectivity("online");
    expect(screen.queryByTestId("offline-indicator")).toBeNull();
  });

  it("shows immediately on mount if already offline", () => {
    setOnline(false);
    render(<OfflineIndicator />);
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
  });

  it("exposes an accessible status for screen readers", () => {
    setOnline(false);
    render(<OfflineIndicator />);
    // A polite live region announces the offline state (icon itself is decorative).
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/offline/i);
  });
});
