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
      {!hidden && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          aria-expanded={false}
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
            strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <line x1="3.5" y1="7" x2="20.5" y2="7" />
            <line x1="3.5" y1="12" x2="20.5" y2="12" />
            <line x1="3.5" y1="17" x2="20.5" y2="17" />
          </svg>
        </button>
      )}

      {/* Left rail — slim, vertically stacked items, independently scrollable.
          A burger at the top doubles as the close button. */}
      {!hidden && (
        <aside className="nav-panel" data-open={open} aria-hidden={!open}>
          <div className="flex min-h-full flex-col px-1.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition-transform active:scale-90"
              style={{ background: "var(--color-bg-soft)", border: "0.5px solid var(--color-line)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                <line x1="3.5" y1="7" x2="20.5" y2="7" />
                <line x1="3.5" y1="12" x2="20.5" y2="12" />
                <line x1="3.5" y1="17" x2="20.5" y2="17" />
              </svg>
            </button>
            <nav className="flex flex-1 flex-col justify-evenly gap-1">
              {SECONDARY_NAV.map((item) => {
                const active = path === item.href || path.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex flex-col items-center gap-1.5 rounded-control py-2.5 transition-transform active:scale-95"
                    style={{ background: active ? "var(--color-bg-soft)" : "transparent" }}
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-control"
                      style={{
                        background: active ? "color-mix(in oklch, var(--color-accent) 16%, transparent)" : "var(--color-bg-soft)",
                        color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span
                      className="max-w-full truncate text-[10.5px] font-semibold"
                      style={{ color: active ? "var(--color-accent)" : "var(--color-ink-2)" }}
                    >
                      {item.label}
                    </span>
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
