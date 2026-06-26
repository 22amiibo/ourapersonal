"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SECONDARY_NAV } from "./nav/secondaryNav";

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center animate-scrim-in"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="More destinations"
    >
      <div
        className="glass-2 w-full max-w-md rounded-t-sheet px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">More</p>
        <nav className="flex flex-col gap-1">
          {SECONDARY_NAV.map((item) => {
            const active = path === item.href || path.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
                <span className="shrink-0 text-ink-3"><Chevron /></span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
