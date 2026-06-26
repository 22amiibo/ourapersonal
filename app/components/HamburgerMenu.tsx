"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SECONDARY_NAV } from "./nav/secondaryNav";

// Top-left hamburger → left slide-in drawer. An A/B companion to the Summary
// "More" sheet: both render SECONDARY_NAV, so this is purely a navigation-surface
// experiment. The bottom TabBar is untouched. Hidden on auth screens.
export default function HamburgerMenu() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (path === "/login" || path === "/onboarding") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-haspopup="dialog"
        className="fixed left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition-transform active:scale-90"
        style={{
          top: "calc(env(safe-area-inset-top) + 0.5rem)",
          background: "rgba(255,255,255,0.07)",
          border: "0.5px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <line x1="3.5" y1="7" x2="20.5" y2="7" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" />
          <line x1="3.5" y1="17" x2="20.5" y2="17" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex animate-scrim-in"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className="glass-2 flex h-full w-[80%] max-w-xs flex-col rounded-r-sheet px-3 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-drawer-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Menu</p>
            <nav className="flex flex-col gap-1">
              {SECONDARY_NAV.map((item) => {
                const active = path === item.href || path.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-3.5 rounded-control px-3 py-3 transition-colors active:scale-[0.99]"
                    style={{ background: active ? "var(--color-bg-soft)" : "transparent" }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
                      style={{
                        background: active
                          ? "color-mix(in oklch, var(--color-accent) 16%, transparent)"
                          : "var(--color-bg-soft)",
                        color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{item.label}</span>
                      <span className="block truncate text-[12px] text-ink-3">{item.subtitle}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
