import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioRecorder } from "./audio";
import { MAX_AUDIO_SECONDS } from "@/lib/limits";

// --- Minimal MediaRecorder mock ---
class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = "audio/webm";

  constructor(public stream: MediaStream) {
    MockMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    // Emit a chunk then fire stop, mimicking the real lifecycle.
    this.ondataavailable?.({
      data: new Blob(["chunk"], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
  static isTypeSupported() {
    return true;
  }
}

function installMediaMocks() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  // @ts-expect-error -- inject mock recorder
  globalThis.MediaRecorder = MockMediaRecorder;
  return { getUserMedia, track };
}

describe("AudioRecorder", () => {
  beforeEach(() => {
    MockMediaRecorder.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requests mic permission on start (FR2/NFR3)", async () => {
    const { getUserMedia } = installMediaMocks();
    const rec = new AudioRecorder();
    await rec.start();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(rec.isRecording()).toBe(true);
  });

  it("returns an audio blob on stop", async () => {
    installMediaMocks();
    const rec = new AudioRecorder();
    await rec.start();
    const blob = await rec.stop();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/webm");
  });

  it("auto-stops at the 60s cap and notifies via onAutoStop (FR2)", async () => {
    installMediaMocks();
    const onAutoStop = vi.fn();
    const rec = new AudioRecorder({ onAutoStop });
    await rec.start();
    // Advance past the hard cap.
    await vi.advanceTimersByTimeAsync(MAX_AUDIO_SECONDS * 1000 + 10);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(rec.isRecording()).toBe(false);
  });

  it("releases the microphone track on stop", async () => {
    const { track } = installMediaMocks();
    const rec = new AudioRecorder();
    await rec.start();
    await rec.stop();
    expect(track.stop).toHaveBeenCalled();
  });

  it("reports elapsed seconds while recording", async () => {
    installMediaMocks();
    const rec = new AudioRecorder();
    await rec.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(rec.elapsedSeconds()).toBeGreaterThanOrEqual(3);
  });
});
