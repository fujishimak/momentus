import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

/**
 * Route protection at the Edge (FR21). Uses the edge-safe `authConfig` only
 * (no bcrypt/Prisma), so the middleware bundle stays under Vercel's 1 MB Edge
 * limit. The `authorized` callback in authConfig decides access; NextAuth
 * redirects unauthenticated requests to the configured signIn page (/login).
 */
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // Signed-in users hitting /login are sent to the app; everything else is
  // handled by the `authorized` callback (redirect to /login when needed).
  if (req.auth && req.nextUrl.pathname === "/login") {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons).*)",
  ],
};
