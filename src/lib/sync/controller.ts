import { getStore } from "@/lib/db";
import { SyncEngine } from "./engine";
import { HttpSyncServer } from "./client";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

const CURSOR_KEY = "momentus.sync.cursor";

type Listener = (status: SyncStatus) => void;
type LatencyListener = (ms: number) => void;

/**
 * App-wide sync controller (FR29): owns the SyncEngine, persists the pull
 * cursor across reloads, serialises sync runs, and broadcasts status to the UI
 * (SyncStatus). A thin orchestration layer over the unit-tested engine.
 */
class SyncController {
  private engine?: SyncEngine;
  private status: SyncStatus = "idle";
  private readonly listeners = new Set<Listener>();
  private readonly latencyListeners = new Set<LatencyListener>();
  private running = false;
  /** Duration (ms) of the last completed online sync cycle (NFR13). */
  private lastSyncMs?: number;

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

  /** Subscribe to per-cycle sync durations (NFR13 latency budget). */
  subscribeLatency(fn: LatencyListener): () => void {
    this.latencyListeners.add(fn);
    return () => this.latencyListeners.delete(fn);
  }

  /** Duration (ms) of the last completed online sync cycle, if any. */
  getLastSyncMs(): number | undefined {
    return this.lastSyncMs;
  }

  private setStatus(s: SyncStatus): void {
    this.status = s;
    for (const fn of this.listeners) fn(s);
  }

  private recordLatency(ms: number): void {
    this.lastSyncMs = ms;
    for (const fn of this.latencyListeners) fn(ms);
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      // Dev-visible so the NFR13 budget (≤3s, 1.5–2s avg) is measurable.
      console.debug(`[sync] cycle completed in ${Math.round(ms)}ms`);
    }
  }

  /** Monotonic clock when available, else wall-clock. */
  private now(): number {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
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
    const started = this.now();
    try {
      const engine = this.getEngine();
      await engine.push();
      await engine.pull();
      this.writeCursor(engine.getCursor());
      this.setStatus("idle");
      // Measured trigger → local store committed (pull merges into the store).
      // The UI re-renders off the store immediately after (SyncStatus/EntriesList),
      // so this is the controllable end of the NFR13 "trigger → UI" boundary.
      this.recordLatency(this.now() - started);
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
