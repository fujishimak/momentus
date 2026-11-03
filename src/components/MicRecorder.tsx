"use client";

import { useRef, useState } from "react";
import { AudioRecorder } from "@/lib/capture/audio";
import { MAX_AUDIO_SECONDS } from "@/lib/limits";
import { PhotoThumb } from "./PhotoThumb";
import { AddPhotoButton } from "./AddPhotoButton";

type RecState = "idle" | "recording" | "complete";

export interface MicRecorderProps {
  /** Persist the recorded audio (with optional photo). May reject; surfaced. */
  onSave: (audio: Blob, photo?: Blob) => Promise<void> | void;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Mic capture with record states (design §3.1 idle/recording, §3.1a complete).
 * Idle shows the focal mic button; recording shows a stop button + elapsed
 * time with a 60s hard cap (FR2); complete shows "Recording complete!",
 * duration, and the Discard / Save action row.
 */
export function MicRecorder({ onSave }: MicRecorderProps) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function handleStart() {
    setError(null);
    const recorder = new AudioRecorder({
      onAutoStop: () => finishRecording(),
    });
    recorderRef.current = recorder;
    try {
      await recorder.start();
    } catch {
      setError("Microphone access is needed to record. You can type instead.");
      return;
    }
    setState("recording");
    setElapsed(0);
    tickRef.current = setInterval(() => {
      setElapsed((e) => Math.min(e + 1, MAX_AUDIO_SECONDS));
    }, 1000);
  }

  async function finishRecording() {
    stopTick();
    const recorder = recorderRef.current;
    if (!recorder) return;
    const blob = await recorder.stop();
    setRecorded(blob);
    setState("complete");
  }

  function handleDiscard() {
    setRecorded(null);
    setPhoto(null);
    setElapsed(0);
    setError(null);
    setState("idle");
  }

  async function handleSave() {
    if (!recorded) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(recorded, photo ?? undefined);
      setRecorded(null);
      setPhoto(null);
      setElapsed(0);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your entry.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "complete") {
    return (
      <div className="mic-complete">
        <div className="mic-button mic-button--idle" aria-hidden="true">
          <span className="mic-button__glyph">🎤</span>
        </div>
        <p className="mic-complete__status">Recording complete!</p>
        <p className="mic-complete__duration">{formatDuration(elapsed)}</p>
        {photo && <PhotoThumb photo={photo} onRemove={() => setPhoto(null)} />}
        {error && (
          <p className="mic-complete__error" role="alert">
            {error}
          </p>
        )}
        <div className="mic-actions">
          <button
            type="button"
            className="mic-actions__btn"
            onClick={handleDiscard}
          >
            <span aria-hidden="true">🗑️</span> <span>Discard</span>
          </button>
          <button
            type="button"
            className="mic-actions__btn mic-actions__btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            <span aria-hidden="true">💾</span>{" "}
            <span>{saving ? "Saving…" : "Save"}</span>
          </button>
          {!photo && <AddPhotoButton onPhoto={(p) => setPhoto(p)} />}
        </div>
      </div>
    );
  }

  const recording = state === "recording";
  return (
    <div className="capture__focal">
      <button
        type="button"
        className={`mic-button${recording ? " mic-button--recording" : ""}`}
        aria-label={recording ? "Stop recording" : "Start recording"}
        onClick={recording ? finishRecording : handleStart}
      >
        <span className="mic-button__glyph" aria-hidden="true">
          🎤
        </span>
      </button>
      {recording && (
        <p className="mic-button__timer" aria-live="polite">
          {formatDuration(elapsed)} / {formatDuration(MAX_AUDIO_SECONDS)}
        </p>
      )}
      {error && (
        <p className="mic-complete__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
