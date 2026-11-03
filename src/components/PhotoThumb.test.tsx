import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoThumb } from "./PhotoThumb";

// jsdom lacks object-URL helpers; stub them.
beforeAll(() => {
  if (!("createObjectURL" in URL)) {
    // @ts-expect-error -- test stub
    URL.createObjectURL = vi.fn(() => "blob:mock");
    // @ts-expect-error -- test stub
    URL.revokeObjectURL = vi.fn();
  }
});

describe("PhotoThumb (FR5)", () => {
  const photo = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });

  it("renders the photo as an image", () => {
    render(<PhotoThumb photo={photo} onRemove={vi.fn()} />);
    expect(
      screen.getByRole("img", { name: /attached photo/i }),
    ).toBeInTheDocument();
  });

  it("calls onRemove when the × button is tapped", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<PhotoThumb photo={photo} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
