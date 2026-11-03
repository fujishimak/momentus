"use client";

import { useEffect, useState } from "react";

export interface PhotoThumbProps {
  photo: Blob;
  onRemove: () => void;
}

/**
 * Attached-photo thumbnail with a × remove control (design §3.1a / §3.2, FR5).
 * Manages the object URL lifecycle so it is revoked when the photo changes or
 * the component unmounts.
 */
export function PhotoThumb({ photo, onRemove }: PhotoThumbProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  return (
    <div className="photo-thumb">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL, not a remote asset
        <img className="photo-thumb__img" src={url} alt="Attached photo" />
      )}
      <button
        type="button"
        className="photo-thumb__remove"
        aria-label="Remove photo"
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  );
}
