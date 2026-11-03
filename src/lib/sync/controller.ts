import { getStore } from "@/lib/db";
import { SyncEngine } from "./engine";
import { HttpSyncServer } from "./client";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

const CURSOR_KEY = "momentus.sync.cursor";

type Listener = (status: SyncStatus) => void;

/**
 * App-wide sync controller (FR29): owns the SyncEngine, persists the pull
 * cursor across reloads, serialises sync runs, and broadcasts status to the UI
 * (SyncStatus). A thin orchestration layer over the unit-tested engine.
 */
class SyncController {
  private engine?: SyncEngine;
  private status: SyncStatus = "idle";
  private readonly listeners = new Set<Listener>();
  private running = false;

  private getEngine(): SyncEngine {
    if (!this.engine) {
      this.engine = new SyncEngine(getStore(), new HttpSyncServer());
      const saved = this.readCursor();
      if (saved) this.engine.setCursor(saved);
    }
    return this.engine;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: SyncStatus): void {
    this.status = s;
    for (const fn of this.listeners) fn(s);
  }

  /** Run one push+pull cycle. Coalesces concurrent calls; never throws. */
  async sync(): Promise<void> {
    if (this.running) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setStatus("offline");
      return;
    }
    this.running = true;
    this.setStatus("syncing");
    try {
      const engine = this.getEngine();
      await engine.push();
      await engine.pull();
      this.writeCursor(engine.getCursor());
      this.setStatus("idle");
    } catch {
      this.setStatus("error");
    } finally {
      this.running = false;
    }
  }

  private readCursor(): number {
    try {
      return Number(localStorage.getItem(CURSOR_KEY) ?? "0") || 0;
    } catch {
      return 0;
    }
  }

  private writeCursor(value: number): void {
    try {
      localStorage.setItem(CURSOR_KEY, String(value));
    } catch {
      /* ignore */
    }
  }
}

let instance: SyncController | undefined;
export function getSyncController(): SyncController {
  if (!instance) instance = new SyncController();
  return instance;
}
