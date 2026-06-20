"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY_TABS = [
  { href: "/dashboard", label: "Today", emoji: "🏠" },
  { href: "/log", label: "Log", emoji: "📥" },
  { href: "/health", label: "Health", emoji: "📈" },
  { href: "/weekly", label: "Weekly", emoji: "📅" },
  { href: "/reflect", label: "Reflect", emoji: "✏️" },
  { href: "/settings", label: "Settings", emoji: "⚙️" },
];

const HIDE_THRESHOLD = 10;

export default function TabBar() {
  const path = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (delta > HIDE_THRESHOLD) setHidden(true);
      else if (delta < 0) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Clear badge on app focus
  useEffect(() => {
    const clearBadge = () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.active?.postMessage({ type: "CLEAR_BADGE" });
        });
      }
    };
    window.addEventListener("focus", clearBadge);
    clearBadge();
    return () => window.removeEventListener("focus", clearBadge);
  }, []);

  if (path === "/login") return null;

  return (
    <nav
      role="tablist"
      aria-label="Primary navigation"
      className={`fixed inset-x-0 bottom-0 z-20 flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transform-gpu transition-transform duration-300 ease-out will-change-transform ${
        hidden ? "translate-y-[calc(100%+env(safe-area-inset-bottom)+0.75rem)]" : "translate-y-0"
      }`}
    >
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface/90 px-2 py-1.5 backdrop-blur-2xl">
        {PRIMARY_TABS.map((t) => {
          const active =
            path === t.href ||
            (t.href === "/dashboard" && path === "/") ||
            (t.href !== "/dashboard" && path.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition-colors active:scale-95 ${
                active ? "bg-accent/15" : "opacity-40"
              }`}
            >
              {t.emoji}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
