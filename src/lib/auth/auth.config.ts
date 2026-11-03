import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth base config (NextAuth v5 split-config pattern).
 *
 * This file must stay light enough for the Edge runtime (used by middleware):
 * NO bcrypt, NO Prisma, NO Credentials `authorize` here. The full config in
 * `auth.ts` (Node runtime) extends this with the Credentials provider's
 * database-backed authorize. Keeping them split keeps the middleware bundle
 * under Vercel's 1 MB Edge limit.
 */
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const authConfig = {
  session: { strategy: "jwt", maxAge: THIRTY_DAYS, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  // Providers are added in auth.ts (Node runtime). Middleware only needs the
  // session + callbacks to read/authorize the JWT.
  providers: [],
  callbacks: {
    // Gate protected routes at the edge (FR21). /login and /api/auth are open;
    // everything else requires a session.
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      // Open: login page, NextAuth endpoints. API routes enforce auth inside
      // the handler (returning 401 JSON) rather than redirecting to /login,
      // which would be wrong for a fetch client (FR27/NFR9).
      if (
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/")
      ) {
        return true;
      }
      return isLoggedIn;
    },
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
} satisfies NextAuthConfig;
