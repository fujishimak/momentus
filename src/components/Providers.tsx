"use client";

import { SessionProvider } from "next-auth/react";

/** Client wrapper providing the NextAuth session context to the app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
