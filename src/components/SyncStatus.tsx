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
 * Small sync-status indicator (FR31) that also drives sync triggers: runs a
 * sync on mount, when the tab regains focus, and when connectivity returns.
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
