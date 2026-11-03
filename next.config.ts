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
  // Static export so the same build can be wrapped by Capacitor (iOS webview).
  output: "export",
  // Static export cannot run the Next.js image optimizer.
  images: {
    unoptimized: true,
  },
  // Relative asset paths keep the bundle portable to a file:// / webview context.
  // (Vercel serves from root; Capacitor serves from a local origin.)
  trailingSlash: true,
  reactStrictMode: true,
  // NOTE: security headers (X-Content-Type-Options, X-Frame-Options,
  // Referrer-Policy, SW Cache-Control/CSP) are configured at the host/proxy
  // (vercel.json) because `output: 'export'` cannot emit headers here.
};

export default withSerwist(nextConfig);
