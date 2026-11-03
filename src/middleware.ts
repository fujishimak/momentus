import { auth } from "@/lib/auth/auth";

/**
 * Route protection (FR21): unauthenticated requests to app routes are
 * redirected to /login. /login and /api/auth/* are always allowed. Static
 * assets, the service worker, manifest, and icons are excluded via the matcher.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth);
  const isLogin = nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLogin) {
    const url = new URL("/login", nextUrl.origin);
    return Response.redirect(url);
  }
  // Signed-in users hitting /login go to the app.
  if (isLoggedIn && isLogin) {
    return Response.redirect(new URL("/", nextUrl.origin));
  }
});

export const config = {
  // Run on everything except Next internals, the SW, manifest, and static files.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons).*)",
  ],
};
