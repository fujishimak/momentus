import { verifyPassword } from "./password";

/** A user record as needed for credential verification. */
export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  mustChange: boolean;
}

/** The session-safe shape returned on success (no hash). */
export interface AuthorizedUser {
  id: string;
  email: string;
  mustChange: boolean;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Normalize an email for consistent lookup/storage. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure credential check (FR21/FR22/FR24), independent of NextAuth so it is
 * unit-testable. Looks up the user via the injected `lookup`, verifies the
 * bcrypt hash, and returns the session-safe user or null. Never throws on a
 * bad input — a failed login is `null`.
 */
export async function authorizeCredentials(
  credentials: Partial<Credentials>,
  lookup: (email: string) => Promise<AuthUser | null>,
): Promise<AuthorizedUser | null> {
  const email = credentials.email?.trim();
  const password = credentials.password;
  if (!email || !password) return null;

  const user = await lookup(normalizeEmail(email));
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return { id: user.id, email: user.email, mustChange: user.mustChange };
}
