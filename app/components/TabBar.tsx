"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRIMARY_NAV, isRouteActive } from "./nav/registry";
import NavIcon from "./nav/NavIcon";

// The 5 primary tabs (Today / Health / Insights / Reflect / Progress) come
// from the shared nav registry — this file owns only the bar's presentation.
// Secondary destinations live behind the global More sheet and the rail.

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

// One source of truth for every tab chip — guarantees all tabs are identical.
const CHIP_CLASS =
  "relative flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-90";

function chipStyle(active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    // Equal flex cells (min-w-0) so all tabs always share one row and shrink
    // to fit any iPhone width — never wrapping a tab to a second line.
    height: 54,
    minWidth: 0,
    boxSizing: "border-box",
    borderRadius: 17,
    backdropFilter: "blur(12px) saturate(150%)",
    WebkitBackdropFilter: "blur(12px) saturate(150%)",
    transition: "all 200ms ease-out",
  };
  if (active) {
    return {
      ...base,
      background:
        "linear-gradient(180deg, color-mix(in oklch, var(--color-accent) 34%, transparent), color-mix(in oklch, var(--color-accent) 11%, transparent))",
      border: "0.5px solid color-mix(in oklch, var(--color-accent) 50%, transparent)",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2), 0 3px 14px color-mix(in oklch, var(--color-accent) 42%, transparent)",
    };
  }
  return {
    ...base,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04))",
    border: "0.5px solid rgba(255,255,255,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(0,0,0,0.22), 0 2px 5px rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.55)",
  };
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
      className={`fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transform-gpu transition-transform duration-300 ease-out will-change-transform ${
        hidden ? "translate-y-[calc(100%+env(safe-area-inset-bottom)+0.5rem)]" : "translate-y-0"
      }`}
    >
      <div
        className="flex w-full max-w-md items-stretch gap-1.5 rounded-[26px] border px-1.5 py-1.5"
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
        {PRIMARY_NAV.map((t) => {
          const active = isRouteActive(t, path);
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              className={`${CHIP_CLASS} flex-1 ${active ? "text-accent" : ""}`}
              style={chipStyle(active)}
            >
              <span className="relative">
                <NavIcon id={t.id} size={22} active={active} />
                {active && <ActiveDot />}
              </span>
              <span
                className="max-w-full overflow-hidden text-[9px] font-medium tracking-[0.02em] text-ellipsis"
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
