"use client";

import { useEffect } from "react";

/**
 * Registers the Serwist-generated service worker (`/sw.js`) on the client.
 *
 * Renders nothing. Without this, the built service worker is never installed,
 * so offline/precaching and installability are inert. Registration is a no-op
 * when the Service Worker API is unavailable (e.g. older browsers, SSR).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // Fire and forget; failures should not surface to the user.
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failed — app still works online */
    });
  }, []);

  return null;
}
