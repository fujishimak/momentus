import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import {
  toSyncEntry,
  toEntryColumns,
  shouldApplyIncoming,
  MAX_ENTRIES_PER_DAY,
  clampPullLimit,
  buildPullPage,
  type EntryRow,
} from "@/lib/sync/server";
import type { PullResponse, SyncEntry } from "@/lib/sync/types";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Pull (FR29): entries for the signed-in user changed since the cursor,
 * paginated (NFR13 cold-reconnect). Query:
 *   ?since=<epochMs>      exclusive lower bound on updatedAt (the cursor)
 *   &sinceId=<id>         keyset tiebreak: resume after this id at `since`
 *   &limit=<n>            page size (default/clamped server-side)
 * Rows are ordered by (updatedAt asc, id asc). The response carries the next
 * `cursor`/`cursorId` and `hasMore`; the client loops until `hasMore` is false.
 * Includes tombstones so deletes propagate (FR30).
 */
export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const sinceRaw = Number(params.get("since") ?? "0");
  const since = Number.isFinite(sinceRaw) ? sinceRaw : 0;
  const sinceId = params.get("sinceId") ?? undefined;
  const limitRaw = params.get("limit");
  const limit = clampPullLimit(limitRaw != null ? Number(limitRaw) : undefined);

  const sinceDate = new Date(since);
  // Keyset predicate: updatedAt > since OR (updatedAt == since AND id > sinceId).
  // Without a sinceId this is just updatedAt > since (first page / legacy).
  const where = sinceId
    ? {
        userId,
        OR: [
          { updatedAt: { gt: sinceDate } },
          { updatedAt: sinceDate, id: { gt: sinceId } },
        ],
      }
    : { userId, updatedAt: { gt: sinceDate } };

  // Fetch limit+1 to detect whether more pages remain.
  const rows = (await prisma.entry.findMany({
    where,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  })) as EntryRow[];

  const page = buildPullPage(rows.map(toSyncEntry), limit, since);
  const body: PullResponse = page as PullResponse;
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
