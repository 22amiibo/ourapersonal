"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MoreSheet from "./MoreSheet";

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Today",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" fill="currentColor" fillOpacity=".15" /><path d="M9 21V12h6v9" /></>
          : <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></>
        }
      </svg>
    ),
  },
  {
    href: "/health",
    label: "Health",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: "/reflect",
    label: "Reflect",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="currentColor" fillOpacity=".15" /></>
          : <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>
        }
      </svg>
    ),
  },
  {
    href: "/log",
    label: "Log",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
];

// Destinations that live under the More sheet — used to light up the More tab.
const MORE_PATHS = ["/weekly", "/insights", "/settings"];

const MoreIcon = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

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
// Inactive: subtle frosted glass with a top edge-highlight. Active: accent-tinted
// glass with a soft glow. Applied byte-for-byte to the four links AND the More button.
const CHIP_CLASS =
  "relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 transition-all duration-200 active:scale-90";

function chipStyle(active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    minWidth: 56,
    minHeight: 50,
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

export default function TabBar() {
  const path = usePathname();
  const [hidden, setHidden] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

  const moreActive = MORE_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  return (
    <>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <nav
        role="tablist"
        aria-label="Primary navigation"
        className={`fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transform-gpu transition-transform duration-300 ease-out will-change-transform ${
          hidden && !moreOpen ? "translate-y-[calc(100%+env(safe-area-inset-bottom)+0.5rem)]" : "translate-y-0"
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
            const active =
              path === t.href ||
              (t.href === "/dashboard" && path === "/") ||
              path.startsWith(t.href + "/");
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
                  className="text-[9.5px] font-medium tracking-[0.06em]"
                  style={{ lineHeight: 1 }}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}

          {/* More — opens the sheet rather than navigating */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label="More"
            className={`${CHIP_CLASS} ${moreActive || moreOpen ? "text-accent" : ""}`}
            style={chipStyle(moreActive || moreOpen)}
          >
            <span className="relative">{MoreIcon(moreActive || moreOpen)}{moreActive && <ActiveDot />}</span>
            <span className="text-[9.5px] font-medium tracking-[0.06em]" style={{ lineHeight: 1 }}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
