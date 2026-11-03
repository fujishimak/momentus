import type { SyncServer } from "./engine";
import type { SyncEntry, PullResponse, BlobPointer } from "./types";

/**
 * HTTP implementation of {@link SyncServer} — talks to the Next.js API routes
 * (/api/blob, /api/entries). Session cookie is sent automatically. Used by the
 * app; tests use a fake server instead.
 */
export class HttpSyncServer implements SyncServer {
  async uploadBlob(kind: "audio" | "photo", blob: Blob): Promise<BlobPointer> {
    const res = await fetch(`/api/blob?kind=${kind}`, {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
    });
    if (!res.ok) throw new Error(`blob upload failed: ${res.status}`);
    return (await res.json()) as BlobPointer;
  }

  async push(entries: SyncEntry[]): Promise<void> {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
  }

  async pull(since: number): Promise<PullResponse> {
    const res = await fetch(`/api/entries?since=${since}`);
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    return (await res.json()) as PullResponse;
  }
}
