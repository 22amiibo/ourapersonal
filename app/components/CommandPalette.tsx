"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NAV_ROUTES, type NavRoute } from "./nav/registry";
import NavIcon from "./nav/NavIcon";

// A spotlight-style command palette. Two ways in:
//   • Keyboard: ⌘K / Ctrl+K (desktop / external keyboards).
//   • Pull-down: drag down from the very top of the page (touch), the way
//     iOS Spotlight opens — natural on the iPhone PWA where there's no ⌘K.
// It's a pure navigator (no data mutation), so it can live globally in layout.
// Destinations, hints, and search keywords all come from the shared nav
// registry — the palette never keeps its own route list.

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<NavRoute[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return NAV_ROUTES;
    return NAV_ROUTES.filter(
      (c) => c.label.toLowerCase().includes(term) || c.keywords.includes(term)
    );
  }, [q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setSel(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      if (href !== pathname) router.push(href);
    },
    [close, pathname, router]
  );

  // ⌘K / Ctrl+K toggle + global Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Pull-down-to-open: a downward drag that begins at the top of the page.
  useEffect(() => {
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      if (open) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, [contenteditable], [data-no-pull]")) return;
      if (window.scrollY > 2) return;
      startY = e.touches[0].clientY;
      tracking = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 90) {
        tracking = false;
        setOpen(true);
      } else if (dy < -8) {
        tracking = false;
      }
    };
    const onEnd = () => { tracking = false; };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  // Focus the field and reset selection whenever it opens.
  useEffect(() => {
    if (open) {
      setSel(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+14vh)] animate-scrim-in"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="h-fit w-full max-w-md overflow-hidden rounded-sheet glass-2 animate-spring-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span className="text-ink-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); const r = results[sel]; if (r) go(r.href); }
            }}
            placeholder="Jump to…"
            aria-label="Search commands"
            className="flex-1 bg-transparent text-[16px] text-ink placeholder-ink-3 focus:outline-none"
          />
          <kbd className="hidden rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3 sm:block">esc</kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto p-1.5 no-scrollbar">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-[14px] text-ink-3">No matches.</li>
          ) : (
            results.map((c, i) => {
              const active = i === sel;
              return (
                <li key={c.href}>
                  <button
                    onClick={() => go(c.href)}
                    onMouseEnter={() => setSel(i)}
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors min-h-[44px]"
                    style={active ? { background: "color-mix(in oklch, var(--color-accent) 16%, transparent)" } : undefined}
                  >
                    <span style={{ color: active ? "var(--color-accent)" : "var(--color-ink-2)" }}>
                      <NavIcon id={c.id} size={18} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[14px] font-medium text-ink">{c.label}</span>
                      <span className="block text-[12px] text-ink-3">{c.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
