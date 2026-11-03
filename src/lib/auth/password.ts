import bcrypt from "bcryptjs";

/**
 * Server-side password hashing (FR22, NFR10). bcryptjs (pure JS, no native
 * build — safe on Vercel serverless). Never import into client components.
 */

const COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST);
}

/** Verify a plaintext against a bcrypt hash. Returns false (never throws) on a
 * malformed/empty hash so callers can treat it as a failed login. */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  if (!hash || !/^\$2[aby]\$/.test(hash)) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}
