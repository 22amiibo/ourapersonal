"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Tab = {
  href: string;
  label: string;
  // Active when the current path equals href, or starts with href + "/".
  // Summary also matches "/" (root redirects to /dashboard).
  match?: (path: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
};

const sw = (active: boolean) => (active ? 2.2 : 1.75);

// Five tabs, replacing the previous Today/Health/Reflect/Log + More set.
// Apple-Health structure, Briefing's own teal icon set.
const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Summary",
    match: (p) => p === "/dashboard" || p === "/" || p.startsWith("/dashboard/"),
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" fill="currentColor" fillOpacity=".18" />
          : null}
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    ),
  },
  {
    href: "/trends",
    label: "Trends",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="20" x2="6" y2="13" />
        <line x1="12" y1="20" x2="12" y2="8" />
        <line x1="18" y1="20" x2="18" y2="4" />
      </svg>
    ),
  },
  {
    href: "/observations",
    label: "Observations",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" fill="currentColor" fillOpacity=".18" />
          : null}
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" />
      </svg>
    ),
  },
  {
    href: "/log",
    label: "Inputs",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: "/articles",
    label: "Articles",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={sw(active)} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <rect x="3" y="4" width="18" height="16" rx="2.5" fill="currentColor" fillOpacity=".15" />
          : null}
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <line x1="7" y1="9" x2="17" y2="9" />
        <line x1="7" y1="13" x2="14" y2="13" />
      </svg>
    ),
  },
];

const HIDE_THRESHOLD = 12;

function ActiveDot() {
  return (
    <span
      aria-hidden
      className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent"
      style={{ boxShadow: "0 0 6px 1px color-mix(in oklch, var(--color-accent) 60%, transparent)" }}
    />
  );
}

// One source of truth for every tab chip — guarantees all five are identical.
const CHIP_CLASS =
  "relative flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-90";

function chipStyle(active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    // Fixed (not min) dimensions → every tab is a pixel-identical container
    // regardless of label length, and no layout shift when switching tabs.
    width: 62,
    height: 52,
    flex: "none",
    boxSizing: "border-box",
    borderRadius: 16,
    backdropFilter: "blur(12px) saturate(150%)",
    WebkitBackdropFilter: "blur(12px) saturate(150%)",
    transition: "all 200ms ease-out",
  };
  if (active) {
    return {
      ...base,
      background:
        "linear-gradient(180deg, color-mix(in oklch, var(--color-accent) 32%, transparent), color-mix(in oklch, var(--color-accent) 12%, transparent))",
      border: "0.5px solid color-mix(in oklch, var(--color-accent) 45%, transparent)",
      boxShadow:
        "inset 0 0.5px 0 rgba(255,255,255,0.35), 0 2px 12px color-mix(in oklch, var(--color-accent) 38%, transparent)",
    };
  }
  return {
    ...base,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))",
    border: "0.5px solid rgba(255,255,255,0.15)",
    boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.22)",
    color: "rgba(255,255,255,0.55)",
  };
}

function isActive(tab: Tab, path: string): boolean {
  if (tab.match) return tab.match(path);
  return path === tab.href || path.startsWith(tab.href + "/");
}

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
      else if (delta < -4) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  if (path === "/login" || path === "/onboarding") return null;

  return (
    <nav
      role="tablist"
      aria-label="Primary navigation"
      className={`fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transform-gpu transition-transform duration-300 ease-out will-change-transform ${
        hidden ? "translate-y-[calc(100%+env(safe-area-inset-bottom)+0.5rem)]" : "translate-y-0"
      }`}
    >
      <div
        className="flex items-center gap-1.5 rounded-[26px] border px-2 py-1.5"
        style={{
          background:
            "linear-gradient(180deg, rgba(42,42,48,0.55), rgba(18,18,22,0.66))",
          borderColor: "rgba(255,255,255,0.16)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.32)",
        }}
      >
        {TABS.map((t) => {
          const active = isActive(t, path);
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              className={`${CHIP_CLASS} ${active ? "text-accent" : ""}`}
              style={chipStyle(active)}
            >
              <span className="relative">{t.icon(active)}{active && <ActiveDot />}</span>
              <span
                className="text-[9px] font-medium tracking-[0.04em]"
                style={{ lineHeight: 1, whiteSpace: "nowrap" }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
