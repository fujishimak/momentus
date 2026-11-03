// @vitest-environment node
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing (FR22, server-side bcrypt)", () => {
  it("produces a bcrypt hash that is not the plaintext", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(hash).not.toBe("s3cret-pass");
    // bcrypt hashes start with $2a$/$2b$ and are 60 chars.
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash.length).toBe(60);
  });

  it("produces a different hash each call (random salt)", async () => {
    const a = await hashPassword("samePass1");
    const b = await hashPassword("samePass1");
    expect(a).not.toBe(b);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("Correct-horse1");
    expect(await verifyPassword("Correct-horse1", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Correct-horse1");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("returns false for a malformed/empty hash rather than throwing", async () => {
    expect(await verifyPassword("whatever", "")).toBe(false);
    expect(await verifyPassword("whatever", "not-a-hash")).toBe(false);
  });
});
