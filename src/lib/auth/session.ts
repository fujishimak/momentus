import type { AuthRecord, MomentusStore } from "@/lib/db";
import { hashPassword, randomSaltHex, verifyPassword } from "./credentials";

/** The single permitted username (FR17). */
export const AUTH_USERNAME = "joshua.fujishima@gmail.com";

/** Local session flag key (FR20). */
const SESSION_KEY = "momentus.session";

export interface AuthResult {
  ok: boolean;
  /** True when the user must change their password before entering (FR19). */
  mustChange: boolean;
}

/**
 * Seed the initial credential on first run only (FR17/FR18). If an auth record
 * already exists (e.g. the user has since changed their password), it is left
 * untouched so a re-seed never clobbers a changed password.
 */
export async function ensureSeeded(
  store: MomentusStore,
  seed: AuthRecord,
): Promise<void> {
  const existing = await store.getAuth(seed.username);
  if (!existing) {
    await store.putAuth(seed);
  }
}

/** Verify username + password against the stored salted hash (FR16/FR18). */
export async function authenticate(
  store: MomentusStore,
  username: string,
  password: string,
): Promise<AuthResult> {
  const rec = await store.getAuth(username);
  if (!rec || username !== rec.username) {
    return { ok: false, mustChange: false };
  }
  const ok = await verifyPassword(password, rec.salt, rec.passwordHash);
  return { ok, mustChange: ok ? rec.mustChange : false };
}

/** Set a new password (new salt+hash) and clear the forced-change flag (FR19). */
export async function changePassword(
  store: MomentusStore,
  username: string,
  newPassword: string,
): Promise<void> {
  const salt = randomSaltHex();
  const passwordHash = await hashPassword(newPassword, salt);
  await store.putAuth({ username, salt, passwordHash, mustChange: false });
}

// --- Session flag (browser only; FR20) ---

/** Safe accessor: localStorage can be absent or partially implemented
 * (private mode, some webviews, jsdom). All access is guarded. */
function safeLocalStorage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls && typeof ls.getItem === "function") return ls;
  } catch {
    /* access can throw in sandboxed contexts */
  }
  return null;
}

export function isSignedIn(): boolean {
  const ls = safeLocalStorage();
  try {
    return ls?.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSignedIn(signedIn: boolean): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    if (signedIn) ls.setItem(SESSION_KEY, "1");
    else if (typeof ls.removeItem === "function") ls.removeItem(SESSION_KEY);
    else ls.setItem(SESSION_KEY, "");
  } catch {
    /* storage write failed; session simply won't persist */
  }
}
