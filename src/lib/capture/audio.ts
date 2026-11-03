import { MAX_AUDIO_SECONDS } from "@/lib/limits";

export interface AudioRecorderOptions {
  /** Called when the recorder auto-stops at the {@link MAX_AUDIO_SECONDS} cap. */
  onAutoStop?: () => void;
}

/**
 * Thin wrapper over MediaRecorder with a hard 60s cap (FR2). Requests the mic
 * on {@link start} (permission on first use, NFR3), accumulates chunks, and
 * resolves a single audio Blob on {@link stop}. Releases the mic track when
 * recording ends.
 *
 * Kept backend-free so the capture UI depends only on this abstraction and the
 * Capacitor build can swap the underlying recorder later if needed.
 */
export class AudioRecorder {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private capTimer?: ReturnType<typeof setTimeout>;
  private startedAt = 0;
  private readonly onAutoStop?: () => void;

  constructor(options: AudioRecorderOptions = {}) {
    this.onAutoStop = options.onAutoStop;
  }

  isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  /** Seconds elapsed since recording started (0 when not recording). */
  elapsedSeconds(): number {
    if (!this.startedAt) return 0;
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  /** Begin recording. Prompts for mic permission (FR2/NFR3). */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const recorder = new MediaRecorder(this.stream);
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder = recorder;
    this.startedAt = Date.now();
    recorder.start();

    // Hard cap at 60s (FR2).
    this.capTimer = setTimeout(() => {
      void this.stop().then(() => this.onAutoStop?.());
    }, MAX_AUDIO_SECONDS * 1000);
  }

  /** Stop recording and resolve the accumulated audio as one Blob. */
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
        return;
      }
      if (this.capTimer) {
        clearTimeout(this.capTimer);
        this.capTimer = undefined;
      }
      const mimeType = recorder.mimeType || "audio/webm";
      recorder.onstop = () => {
        this.releaseStream();
        this.startedAt = 0;
        resolve(new Blob(this.chunks, { type: mimeType }));
      };
      recorder.stop();
    });
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
  }
}
