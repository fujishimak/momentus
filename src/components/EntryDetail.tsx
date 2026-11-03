"use client";

import { useEffect, useState } from "react";
import { getStore, type Entry } from "@/lib/db";
import { formatEntryTimestamp } from "@/lib/entries/view";

export interface EntryDetailProps {
  entryId: string;
  /** Called after the entry is deleted (navigate back). */
  onDeleted: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "loaded"; entry: Entry };

/**
 * Entry detail view (design §3.6, FR15): play audio or read full text, view the
 * attached photo, see timestamp + lat/lng metadata, and delete.
 */
export function EntryDetail({ entryId, onDeleted }: EntryDetailProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    getStore()
      .getEntry(entryId)
      .then((entry) => {
        if (!active) return;
        setState(entry ? { status: "loaded", entry } : { status: "missing" });
      });
    return () => {
      active = false;
    };
  }, [entryId]);

  // Manage object URLs for media.
  useEffect(() => {
    if (state.status !== "loaded") return;
    const { entry } = state;
    let aUrl: string | null = null;
    let pUrl: string | null = null;
    if (entry.audioBlob) {
      aUrl = URL.createObjectURL(entry.audioBlob);
      setAudioUrl(aUrl);
    }
    if (entry.photoBlob) {
      pUrl = URL.createObjectURL(entry.photoBlob);
      setPhotoUrl(pUrl);
    }
    return () => {
      if (aUrl) URL.revokeObjectURL(aUrl);
      if (pUrl) URL.revokeObjectURL(pUrl);
    };
  }, [state]);

  async function handleDelete() {
    setDeleting(true);
    await getStore().softDeleteEntry(entryId);
    onDeleted();
  }

  if (state.status === "loading") {
    return <p className="screen__placeholder">Loading…</p>;
  }
  if (state.status === "missing") {
    return <p className="screen__placeholder">Entry not found.</p>;
  }

  const { entry } = state;
  return (
    <article className="entry-detail">
      <p className="entry-detail__time">
        {formatEntryTimestamp(entry.createdAt)}
      </p>

      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img className="entry-detail__photo" src={photoUrl} alt="Entry photo" />
      )}

      {entry.modality === "audio" && audioUrl && (
        <audio
          data-testid="audio-player"
          className="entry-detail__audio"
          src={audioUrl}
          controls
        />
      )}

      {entry.modality === "audio" && entry.transcriptPending ? (
        <p className="entry-detail__transcript entry-detail__transcript--pending">
          Transcribing…
        </p>
      ) : (
        entry.textContent.trim() !== "" && (
          <p className="entry-detail__text">{entry.textContent}</p>
        )
      )}

      {entry.lat !== undefined && entry.lng !== undefined && (
        <p className="entry-detail__meta">
          📍 {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
        </p>
      )}

      <button
        type="button"
        className="entry-detail__delete"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? "Deleting…" : "Delete entry"}
      </button>
    </article>
  );
}
