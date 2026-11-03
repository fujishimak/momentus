import { put } from "@vercel/blob";
import { auth } from "@/lib/auth/auth";
import type { BlobPointer } from "@/lib/sync/types";

/**
 * Upload a binary (audio/photo) to Vercel Blob and return its pointer
 * (FR28/FR31). Owner-scoped path; random suffix makes the URL non-guessable
 * (NFR10). Bytes never touch Postgres. Requires an authenticated session
 * (401 JSON, not a redirect).
 *
 * POST body = raw bytes; query: ?kind=audio|photo&name=<filename>
 */
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "audio" && kind !== "photo") {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }
  const contentType =
    req.headers.get("content-type") ?? "application/octet-stream";
  const body = await req.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }

  // Owner-scoped, random-suffixed path so URLs are not guessable (NFR10).
  const pathname = `entries/${userId}/${kind}-${crypto.randomUUID()}`;
  const blob = await put(pathname, body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  const pointer: BlobPointer = {
    url: blob.url,
    type: contentType,
    size: body.byteLength,
  };
  return Response.json(pointer, { status: 201 });
}
