import { hashPassword } from "./password";

export const MIN_PASSWORD_LENGTH = 8;

/** Thrown when a new password fails the rules (FR23). */
export class PasswordRuleError extends Error {
  constructor(
    message = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  ) {
    super(message);
    this.name = "PasswordRuleError";
  }
}

export interface PasswordUpdate {
  id: string;
  passwordHash: string;
  mustChange: boolean;
}

/**
 * Validate + hash a new password and persist via the injected `update`
 * (clearing mustChange). Pure over the updater so it is unit-testable without
 * a database (FR23 forced first-login change).
 */
export async function changePasswordFor(
  userId: string,
  newPassword: string,
  update: (u: PasswordUpdate) => Promise<void>,
): Promise<void> {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordRuleError();
  }
  const passwordHash = await hashPassword(newPassword);
  await update({ id: userId, passwordHash, mustChange: false });
}
