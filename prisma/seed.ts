/**
 * Seed the single Momentus user (FR23). The initial password is read from the
 * SEED_INITIAL_PASSWORD env var — it is NEVER committed. Run once after the DB
 * is provisioned:
 *
 *   SEED_INITIAL_PASSWORD='<the 8-char password>' pnpm db:seed
 *
 * Idempotent: if the user exists, it is left untouched (so a re-seed never
 * clobbers a changed password).
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { normalizeEmail } from "../src/lib/auth/authorize";

const prisma = new PrismaClient();
const EMAIL = "joshua.fujishima@gmail.com";

async function main() {
  const email = normalizeEmail(EMAIL);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists — leaving untouched.`);
    return;
  }

  const initial = process.env.SEED_INITIAL_PASSWORD;
  if (!initial) {
    throw new Error(
      "SEED_INITIAL_PASSWORD env var is required to seed the initial user.",
    );
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(initial),
      mustChange: true,
    },
  });
  console.log(`Seeded user ${email} (mustChange=true).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
