import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

// usePathname is a client hook from next/navigation; stub it for the test.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("BottomNav", () => {
  it("renders the three primary destinations", () => {
    render(<BottomNav />);
    expect(
      screen.getByRole("link", { name: /your entries/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /chat with ai/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /capture/i })).toBeInTheDocument();
  });

  it("links to the correct routes", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /your entries/i })).toHaveAttribute(
      "href",
      "/entries",
    );
    expect(screen.getByRole("link", { name: /chat with ai/i })).toHaveAttribute(
      "href",
      "/chat",
    );
    expect(screen.getByRole("link", { name: /capture/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("marks the active destination with aria-current", () => {
    render(<BottomNav />);
    // pathname is mocked to "/", so Capture is active.
    expect(screen.getByRole("link", { name: /capture/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /your entries/i }),
    ).not.toHaveAttribute("aria-current");
  });
});
