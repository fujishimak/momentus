"use client";

import { useEffect, useState } from "react";
import {
  getSyncController,
  type SyncStatus as Status,
} from "@/lib/sync/controller";

const LABELS: Record<Status, string> = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
  error: "Sync error",
};

/**
 * Small INLINE sync-status indicator that also drives sync triggers: runs a
 * sync on mount, when the tab regains focus, and when connectivity returns.
 *
 * It surfaces synced / syncing / sync-error (and upload-pending in future).
 * The `offline` state is intentionally NOT rendered here — the global
 * top-left `OfflineIndicator` (FR33 / design §12.9) owns the disconnected
 * signal, so showing it inline too would double-signal.
 */
export function SyncStatus() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const controller = getSyncController();
    const unsubscribe = controller.subscribe(setStatus);

    const run = () => void controller.sync();
    run(); // on mount

    window.addEventListener("online", run);
    window.addEventListener("focus", run);
    return () => {
      unsubscribe();
      window.removeEventListener("online", run);
      window.removeEventListener("focus", run);
    };
  }, []);

  // Offline is surfaced by the global OfflineIndicator; stay quiet inline.
  if (status === "offline") return null;

  return (
    <span
      className="sync-status"
      role="status"
      aria-live="polite"
      data-status={status}
    >
      {LABELS[status]}
    </span>
  );
}
