"use client";

import { useEffect, useState } from "react";

/**
 * Global offline indicator (FR33 / design §12.9).
 *
 * Icon-only — a cloud glyph with a strikethrough — pinned to the top-left of
 * the viewport, shown ONLY while the device is disconnected and cleared on
 * reconnect. Lives in the app shell so it is a global mode signal, not a
 * screen-local label (that remains the inline `SyncStatus`). Non-dismissible
 * while offline; safe-area aware; must not occlude primary actions.
 *
 * The glyph is decorative (aria-hidden); a polite live region carries the
 * accessible "Working offline" status for screen readers.
 */
export function OfflineIndicator() {
  // Start optimistic (online) so SSR/first paint matches the common case; the
  // mount effect reconciles with the real navigator.onLine immediately.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync(); // reconcile on mount (handles "already offline")

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-indicator" data-testid="offline-indicator">
      {/* Decorative cloud-with-strikethrough glyph. */}
      <span className="offline-indicator__icon" aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* cloud */}
          <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97 6 6 0 0 0-11.3-1.6A4 4 0 0 0 6.5 19H17.5Z" />
          {/* strikethrough */}
          <line x1="3" y1="3" x2="21" y2="21" />
        </svg>
      </span>
      <span role="status" aria-live="polite" className="offline-indicator__sr">
        Working offline
      </span>
    </div>
  );
}
