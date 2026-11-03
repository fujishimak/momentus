// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDbStore } from "@/lib/db";
import { hashPassword, randomSaltHex } from "./credentials";
import {
  ensureSeeded,
  authenticate,
  changePassword,
  AUTH_USERNAME,
} from "./session";

let n = 0;
async function freshStore() {
  n += 1;
  return new IndexedDbStore(`auth-session-test-${n}`);
}

// A known seed credential for tests (salt+hash of "Initial1").
async function seedConst() {
  const salt = randomSaltHex();
  const passwordHash = await hashPassword("Initial1", salt);
  return { username: AUTH_USERNAME, salt, passwordHash, mustChange: true };
}

describe("auth session (FR16-FR20)", () => {
  let store: IndexedDbStore;
  beforeEach(async () => {
    store = await freshStore();
  });

  it("seeds the initial credential on first run only", async () => {
    const seed = await seedConst();
    await ensureSeeded(store, seed);
    const rec = await store.getAuth(AUTH_USERNAME);
    expect(rec?.username).toBe(AUTH_USERNAME);
    expect(rec?.mustChange).toBe(true);

    // Seeding again must not overwrite an existing (possibly changed) record.
    const changedSalt = randomSaltHex();
    const changedHash = await hashPassword("Changed9", changedSalt);
    await store.putAuth({
      username: AUTH_USERNAME,
      salt: changedSalt,
      passwordHash: changedHash,
      mustChange: false,
    });
    await ensureSeeded(store, seed);
    const after = await store.getAuth(AUTH_USERNAME);
    expect(after?.mustChange).toBe(false); // not clobbered
  });

  it("authenticates the correct password and reports mustChange", async () => {
    await ensureSeeded(store, await seedConst());
    const result = await authenticate(store, AUTH_USERNAME, "Initial1");
    expect(result.ok).toBe(true);
    expect(result.mustChange).toBe(true);
  });

  it("rejects a wrong password", async () => {
    await ensureSeeded(store, await seedConst());
    const result = await authenticate(store, AUTH_USERNAME, "wrongpass");
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown username", async () => {
    await ensureSeeded(store, await seedConst());
    const result = await authenticate(store, "someone@else.com", "Initial1");
    expect(result.ok).toBe(false);
  });

  it("changes the password and clears mustChange (FR19)", async () => {
    await ensureSeeded(store, await seedConst());
    await changePassword(store, AUTH_USERNAME, "NewPass42");

    // Old password no longer works; new one does, and no change is required.
    expect((await authenticate(store, AUTH_USERNAME, "Initial1")).ok).toBe(
      false,
    );
    const after = await authenticate(store, AUTH_USERNAME, "NewPass42");
    expect(after.ok).toBe(true);
    expect(after.mustChange).toBe(false);
  });
});
