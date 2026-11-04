"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";

/**
 * App shell. Hides the bottom nav on the full-screen /login route; otherwise
 * renders the main content + persistent bottom nav (design §2).
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <main className="app-main app-main--full">{children}</main>;
  }

  return (
    <div className="app-shell">
      <OfflineIndicator />
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
