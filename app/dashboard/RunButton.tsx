"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunButton() {
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
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-ink-3 border-t-accent" />
        )}
        {loading ? "Generating…" : "Generate today's briefing"}
      </button>
      {msg && <p className="text-xs text-ink-2">{msg}</p>}
    </div>
  );
}