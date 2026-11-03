import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // Service worker source + output (Serwist, webpack/Turbopack compatible).
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Disable the SW in dev to avoid caching headaches during the TDD loop.
  disable: process.env.NODE_ENV === "development",
});

import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in $HOME would
  // otherwise confuse Next's root inference).
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  // Hosted Next.js server app (Amendment 2 / design §12): NextAuth + API routes
  // require a server, so static export is NOT used. Deployed to Vercel.
  reactStrictMode: true,
  // Security headers now emitted here (a server app can set headers; this
  // replaces the static-export-era vercel.json headers). SW gets no-cache + CSP.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
