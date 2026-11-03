"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import {
  changePasswordFor,
  PasswordRuleError,
} from "@/lib/auth/change-password";

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

/**
 * Server action for the forced first-login password change (FR23). Requires an
 * authenticated session; updates the signed-in user's hash and clears
 * mustChange. The client then refreshes the session (new JWT) to clear the flag.
 */
export async function changeOwnPassword(
  newPassword: string,
): Promise<ChangePasswordResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in." };

  try {
    await changePasswordFor(userId, newPassword, async (u) => {
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: u.passwordHash, mustChange: u.mustChange },
      });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof PasswordRuleError) return { ok: false, error: e.message };
    return { ok: false, error: "Could not change your password." };
  }
}
