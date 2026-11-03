// @vitest-environment node
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, randomSaltHex } from "./credentials";

describe("password hashing (FR18, NFR8)", () => {
  it("produces a hash different from the plaintext", async () => {
    const salt = randomSaltHex();
    const hash = await hashPassword("secret123", salt);
    expect(hash).not.toBe("secret123");
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // 256-bit hex
  });

  it("is deterministic for the same password + salt", async () => {
    const salt = randomSaltHex();
    const a = await hashPassword("hunter2A", salt);
    const b = await hashPassword("hunter2A", salt);
    expect(a).toBe(b);
  });

  it("differs when the salt differs", async () => {
    const a = await hashPassword("samePass1", randomSaltHex());
    const b = await hashPassword("samePass1", randomSaltHex());
    expect(a).not.toBe(b);
  });

  it("verifies a correct password", async () => {
    const salt = randomSaltHex();
    const hash = await hashPassword("Correct1", salt);
    expect(await verifyPassword("Correct1", salt, hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const salt = randomSaltHex();
    const hash = await hashPassword("Correct1", salt);
    expect(await verifyPassword("Wrong1", salt, hash)).toBe(false);
  });

  it("generates 16-byte (32 hex char) salts", () => {
    expect(randomSaltHex()).toMatch(/^[0-9a-f]{32}$/);
  });
});
