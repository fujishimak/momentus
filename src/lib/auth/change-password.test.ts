// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { changePasswordFor, PasswordRuleError } from "./change-password";
import { verifyPassword } from "./password";

describe("changePasswordFor (FR23 forced change)", () => {
  it("hashes the new password, clears mustChange, and persists", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    await changePasswordFor("u1", "BrandNew99", update);

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0] as {
      id: string;
      passwordHash: string;
      mustChange: boolean;
    };
    expect(arg.id).toBe("u1");
    expect(arg.mustChange).toBe(false);
    expect(arg.passwordHash).not.toBe("BrandNew99");
    expect(await verifyPassword("BrandNew99", arg.passwordHash)).toBe(true);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const update = vi.fn();
    await expect(
      changePasswordFor("u1", "short1", update),
    ).rejects.toBeInstanceOf(PasswordRuleError);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an empty password", async () => {
    const update = vi.fn();
    await expect(changePasswordFor("u1", "", update)).rejects.toBeInstanceOf(
      PasswordRuleError,
    );
  });
});
