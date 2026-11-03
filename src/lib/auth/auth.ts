import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { authorizeCredentials, type Credentials as Creds } from "./authorize";

/**
 * NextAuth (Auth.js v5) configuration — Credentials provider, JWT sessions
 * (FR21/FR24/FR25). The credential check delegates to the pure
 * {@link authorizeCredentials} (unit-tested) with a Prisma-backed lookup.
 *
 * Server-only. Requires AUTH_SECRET + DATABASE_URL env vars (FR26/NFR10).
 */
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: THIRTY_DAYS, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
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
  callbacks: {
    // Carry mustChange through the JWT + session so the UI can force a change.
    jwt({ token, user }) {
      if (user) {
        token.mustChange =
          (user as { mustChange?: boolean }).mustChange ?? false;
        if (user.id) token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { mustChange?: boolean }).mustChange = Boolean(
          token.mustChange,
        );
        if (token.uid) session.user.id = token.uid as string;
      }
      return session;
    },
  },
});
