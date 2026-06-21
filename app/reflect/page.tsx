"use client";

import { useEffect, useState } from "react";

type PastReflection = {
  id: number;
  entry_date: string;
  raw_text: string;
  confidence_level: number | null;
  readiness_score: number | null;
  sleep_score: number | null;
};

const PROMPTS = [
  "What was the most important thing you did today?",
  "What are you grateful for right now?",
  "What challenged you today, and how did you respond?",
  "What's one thing you'd do differently if you could redo today?",
  "Where did you spend your energy, and was it worth it?",
  "What did you learn today — about anything or anyone?",
  "What's weighing on your mind heading into tomorrow?",
  "When did you feel most like yourself today?",
];

function dayOfYear(d: Date = new Date()): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7v5h10V7M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ReflectPage() {
  const prompt = PROMPTS[dayOfYear() % PROMPTS.length];
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [reflections, setReflections] = useState<PastReflection[]>([]);
  const [streak, setStreak] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<PastReflection[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  async function loadHistory() {
    try {
      const res = await fetch("/api/reflections?limit=10");
      if (res.ok) {
        const data = (await res.json()) as { reflections: PastReflection[]; streak: number };
        setReflections(data.reflections);
        setStreak(data.streak);
      }
    } catch {}
  }

  useEffect(() => { loadHistory(); }, []);

  async function save() {
    setStatus("saving");
    setMsg("");
    const res = await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setStatus("done");
      setMsg(data.extracted ? "Saved and analyzed." : "Saved (analysis will retry later).");
      setText("");
      loadHistory();
    } else {
      setStatus("error");
      setMsg(data.error || "Something went wrong.");
    }
  }

  async function doSearch() {
    if (!searchQ.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch(`/api/reflections/search?q=${encodeURIComponent(searchQ.trim())}`);
      if (res.ok) {
        const d = await res.json();
        setSearchResults(d.results ?? []);
      }
    } finally {
      setSearching(false);
    }
  }

  const shareReflection = (t: string) => {
    if ("share" in navigator) {
      navigator.share({ text: t, title: "Evening reflection" }).catch(() => {});
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <header className="flex items-start justify-between px-4 animate-spring-in">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Reflect</h1>
          {streak > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-accent" />
              <p className="text-[13px] font-medium text-accent">{streak}-day streak</p>
            </div>
          ) : (
            <p className="mt-0.5 text-[13px] text-ink-3">Write tonight to start a streak.</p>
          )}
        </div>
        <button
          onClick={() => { setShowSearch(!showSearch); setSearchResults(null); setSearchQ(""); }}
          aria-label="Search reflections"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-line text-ink-2 transition-colors active:scale-95"
        >
          <SearchIcon />
        </button>
      </header>

      {showSearch && (
        <section className="mx-4 space-y-3 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Search past reflections</p>
          <div className="flex gap-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Search by topic, keyword…"
              className="flex-1 rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink placeholder-ink-3 focus:border-accent focus:outline-none min-h-[44px]"
            />
            <button
              onClick={doSearch}
              disabled={searching}
              className="rounded-control bg-accent px-4 py-3 text-[14px] font-medium text-bg disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
            >
              {searching ? "…" : "Go"}
            </button>
          </div>
          {searchResults != null && (
            searchResults.length === 0 ? (
              <p className="text-[14px] text-ink-3">No results found.</p>
            ) : (
              <ul className="space-y-3">
                {searchResults.map((r) => (
                  <li key={r.id} className="rounded-control border border-line bg-surface-2 p-3.5">
                    <p className="mb-1.5 font-mono text-[11px] tabular-nums text-ink-3">{r.entry_date}</p>
                    <p className="text-[14px] leading-relaxed text-ink-2">{r.raw_text}</p>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>
      )}

      {/* Today's prompt + compose area */}
      <section className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in" style={{ animationDelay: "80ms" }}>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Today&apos;s Prompt</p>
        <p className="mb-4 text-[15px] font-medium leading-relaxed text-ink">{prompt}</p>
        <div className="h-px bg-line mb-4" />

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Write freely — or respond to the prompt above…"
          className="w-full rounded-control border border-line bg-bg px-4 py-3.5 text-[15px] leading-relaxed text-ink placeholder-ink-3 transition-all duration-200 focus:border-accent focus:outline-none"
        />
        <button
          onClick={save}
          disabled={status === "saving" || !text.trim()}
          className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 min-h-[44px]"
        >
          {status === "saving" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
              Saving…
            </span>
          ) : "Save reflection"}
        </button>

        {msg && (
          <div className={`rounded-control border p-3.5 text-[14px] ${status === "error" ? "border-rose/30 bg-rose/5 text-rose" : "border-accent/30 bg-accent/5 text-accent"}`}>
            {msg}
          </div>
        )}
      </div>
      </section>

      <section className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in" style={{ animationDelay: "240ms" }}>
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Past Reflections</p>
        {reflections.length ? (
          <ul className="space-y-3">
            {reflections.map((r) => (
              <li key={r.id} className="rounded-control border border-line bg-surface-2 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] tabular-nums text-ink-3 shrink-0">{r.entry_date}</span>
                    {r.readiness_score != null && (
                      <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums"
                        style={{ color: "var(--color-accent)", background: "color-mix(in oklch, var(--color-accent) 10%, transparent)" }}>
                        R{r.readiness_score}
                      </span>
                    )}
                    {r.sleep_score != null && (
                      <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums"
                        style={{ color: "var(--color-accent-blue)", background: "color-mix(in oklch, var(--color-accent-blue) 10%, transparent)" }}>
                        S{r.sleep_score}
                      </span>
                    )}
                    {r.confidence_level != null && (
                      <span className="rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-ink-3"
                        style={{ background: "var(--color-surface-3)" }}>
                        {r.confidence_level}/10
                      </span>
                    )}
                  </div>
                  {"share" in (typeof navigator !== "undefined" ? navigator : {}) && (
                    <button
                      onClick={() => shareReflection(r.raw_text)}
                      aria-label="Share"
                      className="text-ink-3 transition-colors hover:text-ink active:scale-95 flex min-h-[36px] min-w-[36px] items-center justify-center shrink-0"
                    >
                      <ShareIcon />
                    </button>
                  )}
                </div>
                <p className="text-[14px] leading-relaxed text-ink-2">{r.raw_text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-control border border-line bg-surface-2 p-4 text-center">
            <p className="text-[14px] font-medium text-ink">No reflections yet.</p>
            <p className="mt-1 text-[13px] text-ink-3">Your first entry above starts a streak.</p>
          </div>
        )}
      </section>
    </main>
  );
}
