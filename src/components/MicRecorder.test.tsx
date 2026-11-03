import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MicRecorder } from "./MicRecorder";

// Mock the AudioRecorder so the component test is deterministic and DOM-only.
// Each stop() returns a fresh Blob (avoids shared-spy value staleness).
let recordingState = false;

vi.mock("@/lib/capture/audio", () => ({
  AudioRecorder: class {
    start = async () => {
      recordingState = true;
    };
    stop = async () => {
      recordingState = false;
      return new Blob(["audio-bytes"], { type: "audio/webm" });
    };
    isRecording = () => recordingState;
    elapsedSeconds = () => 0;
  },
}));

describe("MicRecorder (design §3.1 / §3.1a)", () => {
  beforeEach(() => {
    recordingState = false;
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows the idle mic button initially", () => {
    render(<MicRecorder onSave={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /start recording/i }),
    ).toBeInTheDocument();
  });

  it("starts recording when the mic is tapped", async () => {
    const user = userEvent.setup();
    render(<MicRecorder onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /start recording/i }));
    expect(
      await screen.findByRole("button", { name: /stop recording/i }),
    ).toBeInTheDocument();
  });

  it("enters the recording-complete state with Discard and Save actions", async () => {
    const user = userEvent.setup();
    render(<MicRecorder onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /start recording/i }));
    await user.click(screen.getByRole("button", { name: /stop recording/i }));
    expect(await screen.findByText(/recording complete/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /discard/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });

  it("calls onSave with the recorded blob when Save is tapped", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MicRecorder onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /start recording/i }));
    await user.click(screen.getByRole("button", { name: /stop recording/i }));
    const saveBtn = await screen.findByRole("button", { name: /^save$/i });
    await user.click(saveBtn);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it("discards and returns to idle", async () => {
    const user = userEvent.setup();
    render(<MicRecorder onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /start recording/i }));
    await user.click(screen.getByRole("button", { name: /stop recording/i }));
    await user.click(await screen.findByRole("button", { name: /discard/i }));
    expect(
      await screen.findByRole("button", { name: /start recording/i }),
    ).toBeInTheDocument();
  });
});
