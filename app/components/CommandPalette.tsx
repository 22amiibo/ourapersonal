"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// A spotlight-style command palette. Two ways in:
//   • Keyboard: ⌘K / Ctrl+K (desktop / external keyboards).
//   • Pull-down: drag down from the very top of the page (touch), the way
//     iOS Spotlight opens — natural on the iPhone PWA where there's no ⌘K.
// It's a pure navigator (no data mutation), so it can live globally in layout.

type Command = {
  label: string;
  hint: string;
  href: string;
  keywords: string;
  icon: React.ReactNode;
};

function I({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const COMMANDS: Command[] = [
  { label: "Summary", hint: "Today's briefing & rings", href: "/dashboard", keywords: "home dashboard briefing today readiness", icon: <I d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /> },
  { label: "Trends", hint: "Metric highlights & detail", href: "/trends", keywords: "charts graphs metrics history sleep hrv", icon: <I d="M6 20v-7M12 20V8M18 20V4" /> },
  { label: "Observations", hint: "Reflections & AI notes", href: "/observations", keywords: "observations notes ai insight", icon: <I d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" /> },
  { label: "Inputs", hint: "Log caffeine & alcohol", href: "/log", keywords: "inputs log caffeine alcohol intake add", icon: <I d="M12 3v18M3 12h18" /> },
  { label: "Articles", hint: "Newsletter reader", href: "/articles", keywords: "articles newsletter read email", icon: <I d="M4 5h16v14H4zM7 9h10M7 13h7" /> },
  { label: "Achievements", hint: "Awards & milestones", href: "/achievements", keywords: "achievements awards milestones badges streaks trophies progress", icon: <I d="M12 3l2.4 5 5.6.6-4 4 1 5.4-5-2.8-5 2.8 1-5.4-4-4 5.6-.6z" /> },
  { label: "Reflect", hint: "Write tonight's reflection", href: "/reflect", keywords: "reflect journal write evening reflection", icon: <I d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
  { label: "Insights", hint: "Discovered patterns", href: "/insights", keywords: "insights patterns intelligence ask", icon: <I d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" /> },
  { label: "Weekly", hint: "Weekly review", href: "/weekly", keywords: "weekly review summary rollup", icon: <I d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4" /> },
  { label: "Settings", hint: "Connections & account", href: "/settings", keywords: "settings oura connect account preferences", icon: <I d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2l-.4-2.6H9l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 4 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z" /> },
];

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return COMMANDS;
    return COMMANDS.filter(
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
                    <span style={{ color: active ? "var(--color-accent)" : "var(--color-ink-2)" }}>{c.icon}</span>
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
