"use client";

import { useState } from "react";
import { MAX_WORDS, countWords, clampToWordLimit } from "@/lib/limits";

export interface TextSheetProps {
  /** Persist the entry text. May reject; the message is shown to the user. */
  onSave: (text: string) => Promise<void> | void;
  /** Dismiss the sheet (returns to audio capture). */
  onClose: () => void;
}

/**
 * "Share Your Thoughts" sheet (design §3.2). A word-counted textarea hard-capped
 * at 150 words (FR3) with a Save button. Pure UI — persistence and limit
 * enforcement are injected via onSave (see lib/capture/save-entry).
 */
export function TextSheet({ onSave, onClose }: TextSheetProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = countWords(text);
  const canSave = words > 0 && !saving;

  function handleChange(value: string) {
    // Hard cap at the word limit (FR3): clamp anything over 150 words.
    setText(countWords(value) > MAX_WORDS ? clampToWordLimit(value) : value);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(text.trim());
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-sheet" role="dialog" aria-label="Share your thoughts">
      <div className="text-sheet__header">
        <h2 className="text-sheet__title">Share Your Thoughts</h2>
        <button
          type="button"
          className="text-sheet__close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="text-sheet__field">
        <textarea
          className="text-sheet__input"
          aria-label="Your thoughts"
          placeholder="What happened today?"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          rows={5}
          autoFocus
        />
        <span
          className="text-sheet__counter"
          aria-live="polite"
          data-at-limit={words >= MAX_WORDS}
        >
          {words} / {MAX_WORDS}
        </span>
      </div>

      {error && (
        <p className="text-sheet__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="text-sheet__save"
        onClick={handleSave}
        disabled={!canSave}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
