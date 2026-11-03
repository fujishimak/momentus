import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./auth.config";
import { authorizeCredentials, type Credentials as Creds } from "./authorize";

/**
 * Full NextAuth config (Node runtime). Extends the edge-safe {@link authConfig}
 * with the Credentials provider, whose authorize uses bcrypt + Prisma (both
 * Node-only). Middleware imports `auth.config` instead, keeping the Edge bundle
 * under the 1 MB limit.
 *
 * Requires AUTH_SECRET + the Supabase DB env vars (FR26/NFR10).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const user = await authorizeCredentials(
          credentials as Partial<Creds>,
          (email) => prisma.user.findUnique({ where: { email } }),
        );
        if (!user) return null;
        return { id: user.id, email: user.email, mustChange: user.mustChange };
      },
    }),
  ],
});
