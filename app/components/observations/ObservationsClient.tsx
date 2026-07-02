"use client";

import { useCallback, useEffect, useState } from "react";
import ObservationCard, { type TimelineItem } from "./ObservationCard";
import ErrorState from "@/app/components/ui/ErrorState";
import EmptyState from "@/app/components/ui/EmptyState";
import { SkeletonCard } from "@/app/components/ui/Skeleton";

type ObsRow = { id: number; body: string; range_start: string; range_end: string; created_at: string };
type ReflRow = { id: number; entry_date: string; raw_text: string };

export default function ObservationsClient() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    let obsRes: Response, reflRes: Response;
    try {
      [obsRes, reflRes] = await Promise.all([
        fetch("/api/observations"),
        fetch("/api/reflections?limit=30"),
      ]);
    } catch {
      setLoadFailed(true);
      setLoaded(true);
      return;
    }
    setLoadFailed(!obsRes.ok && !reflRes.ok);
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

      {error && (
        <ErrorState heading="Couldn't generate an observation." body={error} onRetry={generate} />
      )}

      {!loaded ? (
        // Reserve card-sized space while the timeline loads — no pop-in.
        <div className="space-y-4" aria-hidden>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      ) : loadFailed ? (
        <ErrorState heading="Couldn't load your timeline." body="Check your connection and try again." onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          heading="Nothing here yet"
          body="Write a reflection on the Reflect tab, then generate an observation to interpret your recent data."
        />
      ) : (
        items.map((it) => <ObservationCard key={`${it.kind}-${it.id}`} item={it} />)
      )}
    </div>
  );
}
