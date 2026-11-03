import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

describe("ServiceWorkerRegistrar", () => {
  const register = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    register.mockClear();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
  });

  afterEach(() => {
    // Remove the stubbed property between tests.
    // @ts-expect-error -- deleting a defined property for test isolation.
    delete navigator.serviceWorker;
  });

  it("registers /sw.js when the Service Worker API is available", async () => {
    render(<ServiceWorkerRegistrar />);
    // Registration is scheduled in an effect; allow microtasks to flush.
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("renders nothing (no visible output)", () => {
    const { container } = render(<ServiceWorkerRegistrar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not throw when the Service Worker API is unavailable", () => {
    // @ts-expect-error -- simulate an environment without SW support.
    delete navigator.serviceWorker;
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
  });
});
