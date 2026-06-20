"use client";

import { useEffect, useState } from "react";
import ChartContainer from "@/app/components/ui/ChartContainer";

type PastReflection = {
  id: number;
  entry_date: string;
  raw_text: string;
  confidence_level: number | null;
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

  const shareReflection = (text: string) => {
    if ("share" in navigator) {
      navigator.share({ text, title: "Evening reflection" }).catch(() => {});
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Evening reflection</h1>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="shrink-0 rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent">
                🔥 {streak}-day streak
              </span>
            )}
            <button
              onClick={() => { setShowSearch(!showSearch); setSearchResults(null); setSearchQ(""); }}
              aria-label="Search reflections"
              className="flex h-8 w-8 items-center justify-center rounded-control border border-line text-ink-2 transition-colors active:scale-95"
            >
              🔍
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-sm text-ink-2">A few moments to reflect on your day.</p>
      </header>

      {showSearch && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Search past reflections</p>
          <div className="flex gap-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Search by topic, keyword…"
              className="flex-1 rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            />
            <button
              onClick={doSearch}
              disabled={searching}
              className="rounded-control bg-accent px-4 py-3 text-sm font-medium text-bg disabled:opacity-50 active:scale-[0.98]"
            >
              {searching ? "…" : "Go"}
            </button>
          </div>
          {searchResults != null && (
            searchResults.length === 0 ? (
              <p className="text-sm text-ink-3">No results found.</p>
            ) : (
              <ul className="space-y-3">
                {searchResults.map((r) => (
                  <li key={r.id} className="rounded-control border border-line bg-bg/40 p-3.5">
                    <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] tabular-nums text-ink-3">
                      <span>{r.entry_date}</span>
                      {r.confidence_level != null && <><span aria-hidden>·</span><span>confidence {r.confidence_level}/10</span></>}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-2">{r.raw_text}</p>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>
      )}

      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-3">Today's prompt</p>
        <p className="text-sm leading-relaxed text-ink">{prompt}</p>
      </div>

      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">What happened today</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Write freely — or respond to the prompt above…"
          className="w-full rounded-control border border-line bg-surface px-4 py-3 text-ink placeholder-ink-3 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      </section>

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
        <div className={`rounded-control border p-3.5 text-sm ${status === "error" ? "border-rose/30 bg-rose/5 text-rose" : "border-accent/30 bg-accent/5 text-accent"}`}>
          {msg}
        </div>
      )}

      <ChartContainer title="Past reflections">
        {reflections.length ? (
          <ul className="space-y-3">
            {reflections.map((r) => (
              <li key={r.id} className="rounded-control border border-line bg-bg/40 p-3.5">
                <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] tabular-nums text-ink-3">
                  <div className="flex items-center gap-2">
                    <span>{r.entry_date}</span>
                    {r.confidence_level != null && <><span aria-hidden>·</span><span>confidence {r.confidence_level}/10</span></>}
                  </div>
                  {"share" in navigator && (
                    <button
                      onClick={() => shareReflection(r.raw_text)}
                      aria-label="Share"
                      className="text-ink-3 transition-colors hover:text-ink active:scale-95"
                    >
                      ↗
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-ink-2">{r.raw_text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No reflections yet. Write your first above.</p>
        )}
      </ChartContainer>
    </main>
  );
}
