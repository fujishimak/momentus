import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import {
  toSyncEntry,
  toEntryColumns,
  shouldApplyIncoming,
  MAX_ENTRIES_PER_DAY,
  type EntryRow,
} from "@/lib/sync/server";
import type { PullResponse, SyncEntry } from "@/lib/sync/types";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Pull (FR29): entries for the signed-in user changed since `?since=<epochMs>`
 * (inclusive-exclusive), newest-cursor returned for the next pull. Includes
 * tombstones so deletes propagate (FR30).
 */
export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const since = Number(new URL(req.url).searchParams.get("since") ?? "0");
  const rows = (await prisma.entry.findMany({
    where: {
      userId,
      updatedAt: { gt: new Date(Number.isFinite(since) ? since : 0) },
    },
    orderBy: { updatedAt: "asc" },
  })) as EntryRow[];

  const entries = rows.map(toSyncEntry);
  const cursor = entries.reduce(
    (max, e) => Math.max(max, e.updatedAt),
    since || 0,
  );
  const body: PullResponse = { entries, cursor };
  return Response.json(body);
}

/**
 * Push (FR29/FR30/FR32): upsert a batch of entries for the signed-in user.
 * Last-write-wins by updatedAt; server-side 5/day cap for newly-created,
 * non-deleted entries. Returns the applied/rejected ids.
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let incoming: SyncEntry[];
  try {
    const json = await req.json();
    incoming = Array.isArray(json?.entries) ? json.entries : [];
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const applied: string[] = [];
  const rejected: { id: string; reason: string }[] = [];

  for (const entry of incoming) {
    const existing = (await prisma.entry.findUnique({
      where: { id: entry.id },
    })) as EntryRow | null;

    // Owner check: never let a push touch another user's row (NFR10).
    if (existing && existing.userId !== userId) {
      rejected.push({ id: entry.id, reason: "forbidden" });
      continue;
    }

    if (!shouldApplyIncoming(entry, existing)) {
      rejected.push({ id: entry.id, reason: "stale" });
      continue;
    }

    // Server-side 5/day (FR32): only for a brand-new, non-deleted entry.
    if (!existing && !entry.deleted) {
      const count = await prisma.entry.count({
        where: { userId, dayKey: entry.dayKey, deleted: false },
      });
      if (count >= MAX_ENTRIES_PER_DAY) {
        rejected.push({ id: entry.id, reason: "daily-limit" });
        continue;
      }
    }

    const data = toEntryColumns(entry, userId);
    await prisma.entry.upsert({
      where: { id: entry.id },
      create: data,
      update: data,
    });
    applied.push(entry.id);
  }

  return Response.json({ applied, rejected });
}
