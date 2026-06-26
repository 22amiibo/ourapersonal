"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SECONDARY_NAV } from "./nav/secondaryNav";

// Sliding push-panel navigation. Opening translates the whole app shell to the
// right (the page stays partially visible — not replaced by an overlay) while a
// left panel slides in. The panel scrolls independently; body scroll is never
// locked. Closed → the shell animates smoothly back to full width.
//
// Wraps the app's content so a single client-side `open` state can drive both
// the panel and the shell transform. The bottom TabBar (inside `children`)
// rides along with the shell, keeping the push cohesive.
export default function NavShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = path === "/login" || path === "/onboarding";

  return (
    <>
      {!hidden && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Menu"}
          aria-expanded={open}
          className="fixed left-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition-transform active:scale-90"
          style={{
            top: "calc(env(safe-area-inset-top) + 0.5rem)",
            background: "rgba(255,255,255,0.07)",
            border: "0.5px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(16px) saturate(150%)",
            WebkitBackdropFilter: "blur(16px) saturate(150%)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" aria-hidden
            style={{ transition: "transform .3s cubic-bezier(.22,1,.36,1)", transform: open ? "rotate(90deg)" : "none" }}>
            <line x1="3.5" y1="7" x2="20.5" y2="7" />
            <line x1="3.5" y1="12" x2="20.5" y2="12" />
            <line x1="3.5" y1="17" x2="20.5" y2="17" />
          </svg>
        </button>
      )}

      {/* Left panel — vertical, evenly spaced, independently scrollable. */}
      {!hidden && (
        <aside className="nav-panel" data-open={open} aria-hidden={!open}>
          <div className="flex min-h-full flex-col px-3 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">Menu</p>
            <nav className="flex flex-1 flex-col justify-evenly gap-1.5">
              {SECONDARY_NAV.map((item) => {
                const active = path === item.href || path.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-3.5 rounded-control px-3 py-3.5 transition-colors active:scale-[0.99]"
                    style={{ background: active ? "var(--color-bg-soft)" : "transparent" }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
                      style={{
                        background: active ? "color-mix(in oklch, var(--color-accent) 16%, transparent)" : "var(--color-bg-soft)",
                        color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[16px] font-semibold text-ink">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
      )}

      {/* The app shell — everything shifts as one. */}
      <div className="nav-shell flex min-h-dvh flex-col bg-bg" data-open={!hidden && open}>
        {children}
      </div>

      {/* Tap the visible page edge to close. Transparent — the page stays seen. */}
      {!hidden && open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[45] cursor-default"
          style={{ background: "transparent" }}
        />
      )}
    </>
  );
}
