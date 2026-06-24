"use client";

import { useState } from "react";

// "Ask your data" — a question box on the Insights tab. Sends one bounded
// request to /api/insights/ask, which answers from a pre-computed summary.
const SUGGESTIONS = [
  "How has my sleep been this week?",
  "What's hurting my recovery?",
  "Is my HRV trending up or down?",
];

export default function AskData() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [grounded, setGrounded] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");

  async function ask(question: string) {
    const text = question.trim();
    if (!text || status === "loading") return;
    setStatus("loading");
    setAnswer(null);
    setErr("");
    try {
      const res = await fetch("/api/insights/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAnswer(data.answer);
        setGrounded(Boolean(data.grounded));
        setStatus("idle");
      } else {
        setStatus("error");
        setErr(data.error || "Couldn't answer that.");
      }
    } catch {
      setStatus("error");
      setErr("Network error.");
    }
  }

  return (
    <section className="mx-4 mb-3 rounded-card glass-2 p-5 animate-spring-in">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Ask your data</p>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(q)}
          placeholder="Ask about your sleep, recovery, HRV…"
          aria-label="Ask a question about your data"
          className="flex-1 rounded-control border border-line bg-bg-soft px-4 py-3 text-[14px] text-ink placeholder-ink-3 focus:border-accent focus:outline-none min-h-[44px]"
        />
        <button
          onClick={() => ask(q)}
          disabled={status === "loading" || !q.trim()}
          className="rounded-control bg-accent px-4 text-[14px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100 min-h-[44px]"
        >
          {status === "loading" ? "…" : "Ask"}
        </button>
      </div>

      {status !== "loading" && answer == null && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQ(s); ask(s); }}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink-2 transition-transform active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {status === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-3">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
          Reading your data…
        </p>
      )}

      {answer != null && (
        <div className="mt-3 rounded-control border border-line bg-surface-2 p-4">
          <p className="text-[14px] leading-relaxed text-ink">{answer}</p>
          {!grounded && (
            <p className="mt-2 text-[12px] text-ink-3">Limited data — keep logging for sharper answers.</p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 rounded-control border border-rose/30 bg-rose/5 p-3.5 text-[14px] text-rose">{err}</div>
      )}
    </section>
  );
}
