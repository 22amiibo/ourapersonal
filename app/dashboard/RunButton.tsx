"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function run() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/briefing/run", { method: "POST" });
      const d = await res.json();
      if (d.ok) {
        setMsg("Done. Refreshing…");
        router.refresh();
      } else {
        setMsg("Couldn't generate the briefing. Try again.");
      }
    } catch {
      setMsg("Couldn't generate the briefing. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {compact ? (
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-surface-2 px-4 py-2 text-[13px] font-medium text-ink-2 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && (
            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-ink-3 border-t-accent" />
          )}
          {loading ? "Refreshing…" : "Refresh briefing"}
        </button>
      ) : (
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold tracking-[-0.01em] text-bg min-h-[44px] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-bg/40 border-t-bg" />
          )}
          {loading ? "Generating…" : "Generate your briefing"}
        </button>
      )}
      {msg && <p className="text-[13px] text-ink-3">{msg}</p>}
    </div>
  );
}
