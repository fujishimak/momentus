"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

// Order mirrors the design: clock (left) | chat (center) | mic (right).
const NAV_ITEMS: NavItem[] = [
  { href: "/entries", label: "Your Entries", icon: "🕐" },
  { href: "/chat", label: "Chat with AI", icon: "💬" },
  { href: "/", label: "Capture", icon: "🎤" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="bottom-nav__item"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            data-active={isActive}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
