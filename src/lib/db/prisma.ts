import { PrismaClient } from "@prisma/client";

/**
 * Server Prisma client singleton (Vercel Postgres via DATABASE_URL). Reused
 * across hot reloads / serverless invocations to avoid connection exhaustion.
 * Server-only — never import into client components.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
