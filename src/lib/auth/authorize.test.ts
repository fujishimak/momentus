// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { authorizeCredentials, type AuthUser } from "./authorize";
import { hashPassword } from "./password";

async function userWith(
  password: string,
  mustChange = true,
): Promise<AuthUser> {
  return {
    id: "u1",
    email: "joshua.fujishima@gmail.com",
    passwordHash: await hashPassword(password),
    mustChange,
  };
}

describe("authorizeCredentials (FR21/FR22/FR24)", () => {
  it("returns the user session shape on correct credentials", async () => {
    const user = await userWith("GoodPass1");
    const lookup = vi.fn().mockResolvedValue(user);
    const result = await authorizeCredentials(
      { email: "joshua.fujishima@gmail.com", password: "GoodPass1" },
      lookup,
    );
    expect(result).toEqual({
      id: "u1",
      email: "joshua.fujishima@gmail.com",
      mustChange: true,
    });
    expect(lookup).toHaveBeenCalledWith("joshua.fujishima@gmail.com");
  });

  it("returns null for a wrong password", async () => {
    const lookup = vi.fn().mockResolvedValue(await userWith("GoodPass1"));
    expect(
      await authorizeCredentials(
        { email: "joshua.fujishima@gmail.com", password: "wrong" },
        lookup,
      ),
    ).toBeNull();
  });

  it("returns null for an unknown user", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    expect(
      await authorizeCredentials(
        { email: "nobody@example.com", password: "whatever" },
        lookup,
      ),
    ).toBeNull();
  });

  it("returns null when email or password is missing", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    expect(
      await authorizeCredentials({ email: "", password: "x" }, lookup),
    ).toBeNull();
    expect(
      await authorizeCredentials({ email: "a@b.com", password: "" }, lookup),
    ).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("normalizes the email (trim + lowercase) before lookup", async () => {
    const user = await userWith("GoodPass1");
    const lookup = vi.fn().mockResolvedValue(user);
    await authorizeCredentials(
      { email: "  Joshua.Fujishima@GMAIL.com  ", password: "GoodPass1" },
      lookup,
    );
    expect(lookup).toHaveBeenCalledWith("joshua.fujishima@gmail.com");
  });

  it("surfaces mustChange=false once the user has changed their password", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValue(await userWith("GoodPass1", false));
    const result = await authorizeCredentials(
      { email: "joshua.fujishima@gmail.com", password: "GoodPass1" },
      lookup,
    );
    expect(result?.mustChange).toBe(false);
  });
});
