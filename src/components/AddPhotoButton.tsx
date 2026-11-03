"use client";

import { useRef, useState } from "react";
import { preparePhoto } from "@/lib/capture/photo";

export interface AddPhotoButtonProps {
  onPhoto: (photo: Blob) => void;
  /** Visual style: standalone icon (text sheet) or action-row button (audio). */
  variant?: "icon" | "action";
}

/**
 * "Add Photo" control (design §3.1a / §3.2, FR5). Opens the native file/camera
 * picker, prepares the chosen image into a Blob, and hands it to the parent.
 * Only shown once a modality is engaged (the parent controls mounting).
 */
export function AddPhotoButton({
  onPhoto,
  variant = "action",
}: AddPhotoButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      const blob = await preparePhoto(file);
      onPhoto(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that photo.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        className={
          variant === "icon" ? "add-photo add-photo--icon" : "mic-actions__btn"
        }
        aria-label="Add photo"
        onClick={() => inputRef.current?.click()}
      >
        <span aria-hidden="true">📷</span>
        {variant === "action" && <span>Add Photo</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && (
        <p className="add-photo__error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
