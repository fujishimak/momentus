import Link from "next/link";
import type { Entry } from "@/lib/db";
import { entryPreview, formatEntryTimestamp } from "@/lib/entries/view";

export interface EntryCardProps {
  entry: Entry;
}

/** A single row in the entries list (design §3.3): modality icon, date·time,
 * one-line preview, chevron → detail. */
export function EntryCard({ entry }: EntryCardProps) {
  const isAudio = entry.modality === "audio";
  return (
    <Link href={`/entries/detail?id=${entry.id}`} className="entry-card">
      <span
        className="entry-card__icon"
        role="img"
        aria-label={isAudio ? "Audio entry" : "Text entry"}
      >
        {isAudio ? "🎤" : "📝"}
      </span>
      <span className="entry-card__body">
        <span className="entry-card__time">
          {formatEntryTimestamp(entry.createdAt)}
        </span>
        <span className="entry-card__preview">{entryPreview(entry)}</span>
      </span>
      <span className="entry-card__chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
