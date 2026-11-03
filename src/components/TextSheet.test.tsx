import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextSheet } from "./TextSheet";

describe("TextSheet (design §3.2)", () => {
  it("shows the heading and a live word counter starting at 0 / 150", () => {
    render(<TextSheet onSave={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /share your thoughts/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 150")).toBeInTheDocument();
  });

  it("updates the counter as the user types (FR3)", async () => {
    const user = userEvent.setup();
    render(<TextSheet onSave={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "hello there friend");
    expect(screen.getByText("3 / 150")).toBeInTheDocument();
  });

  it("disables Save when empty and enables it with content", async () => {
    const user = userEvent.setup();
    render(<TextSheet onSave={vi.fn()} onClose={vi.fn()} />);
    const save = screen.getByRole("button", { name: /save/i });
    expect(save).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "something");
    expect(save).toBeEnabled();
  });

  it("hard-caps input at 150 words (FR3)", async () => {
    const user = userEvent.setup();
    render(<TextSheet onSave={vi.fn()} onClose={vi.fn()} />);
    const long = Array.from({ length: 160 }, (_, i) => `w${i}`).join(" ");
    await user.click(screen.getByRole("textbox"));
    await user.paste(long);
    expect(screen.getByText("150 / 150")).toBeInTheDocument();
  });

  it("calls onSave with the typed text (and no photo)", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TextSheet onSave={onSave} onClose={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "a good day");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("a good day", undefined);
  });

  it("surfaces a save error message", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("daily limit reached"));
    const user = userEvent.setup();
    render(<TextSheet onSave={onSave} onClose={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /daily limit reached/i,
    );
  });

  it("shows an Add Photo control (FR5) when no photo is attached", () => {
    render(<TextSheet onSave={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /add photo/i }),
    ).toBeInTheDocument();
  });
});
