"use client";

import { useCallback, useEffect, useState } from "react";
import ReflectionComposer from "./ReflectionComposer";
import ObservationCard, { type TimelineItem } from "./ObservationCard";

type ObsRow = { id: number; body: string; range_start: string; range_end: string; created_at: string };
type ReflRow = { id: number; entry_date: string; raw_text: string };

export default function ObservationsClient() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [obsRes, reflRes] = await Promise.all([
      fetch("/api/observations"),
      fetch("/api/reflections?limit=30"),
    ]);
    const obs: ObsRow[] = obsRes.ok ? (await obsRes.json()).observations ?? [] : [];
    const refl: ReflRow[] = reflRes.ok ? (await reflRes.json()).reflections ?? [] : [];

    const merged: TimelineItem[] = [
      ...obs.map((o) => ({
        kind: "observation" as const,
        id: o.id,
        body: o.body,
        range_start: o.range_start,
        range_end: o.range_end,
        ts: new Date(o.created_at).getTime(),
      })),
      ...refl.map((r) => ({
        kind: "reflection" as const,
        id: r.id,
        body: r.raw_text,
        date: r.entry_date,
        ts: new Date(`${r.entry_date}T12:00:00Z`).getTime(),
      })),
    ].sort((a, b) => b.ts - a.ts);

    setItems(merged);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      const r = await fetch("/api/observations", { method: "POST" });
      if (r.ok) {
        await load();
      } else {
        const e = await r.json().catch(() => ({}));
        setError((e as { error?: string }).error ?? "Could not generate an observation.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4 px-4">
      <ReflectionComposer onSaved={load} />

      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-pill px-5 py-3 text-[14px] font-semibold text-accent transition-transform active:scale-95 disabled:opacity-40"
        style={{ border: "0.5px solid color-mix(in oklch, var(--color-accent) 40%, transparent)", background: "color-mix(in oklch, var(--color-accent) 10%, transparent)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2z" />
        </svg>
        {generating ? "Generating…" : "Generate observation"}
      </button>

      {error && <p className="text-[13px] text-rose">{error}</p>}

      {loaded && items.length === 0 ? (
        <div className="rounded-card glass-1 p-6 text-center">
          <p className="text-[15px] font-semibold text-ink">Nothing here yet</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Add a reflection, then generate an observation to interpret your recent data.
          </p>
        </div>
      ) : (
        items.map((it) => <ObservationCard key={`${it.kind}-${it.id}`} item={it} />)
      )}
    </div>
  );
}
