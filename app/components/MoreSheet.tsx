"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Item = {
  href: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
};

const ITEMS: Item[] = [
  {
    href: "/weekly",
    label: "Weekly",
    subtitle: "Trends over the last 12 weeks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/insights",
    label: "Insights",
    subtitle: "Patterns discovered from your data",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    subtitle: "Oura, notifications, account",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

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
          {ITEMS.map((item) => {
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
