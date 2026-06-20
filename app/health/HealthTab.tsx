"use client";

import { useState } from "react";
import TrendChart from "@/app/components/ui/TrendChart";
import type { CorrelationResult } from "@/lib/correlation-utils";
import { formatInsight } from "@/lib/correlation-utils";

type DayRow = { day: string; sleep_score: number | null; readiness_score: number | null };
type LastNight = { sleep_score: number | null; readiness_score: number | null } | null;

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function weekdayLabel(day: string, total: number): string {
  if (total > 14) return day.slice(5); // MM-DD for longer ranges
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, { weekday: "short" });
}

export default function HealthTab({
  allDays,
  lastNight,
  correlations,
}: {
  allDays: DayRow[];
  lastNight: LastNight;
  correlations: CorrelationResult[];
}) {
  const [range, setRange] = useState<Range>(7);

  const days = allDays.slice(-range);
  const labels = days.map((r) => weekdayLabel(r.day, days.length));
  const sleepData = days.map((r) => r.sleep_score ?? 0);
  const readyData = days.map((r) => r.readiness_score ?? 0);
  const hasData = sleepData.some((v) => v > 0);

  const insights = correlations.map(formatInsight).filter(Boolean);

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Health</h1>
          <p className="mt-0.5 text-sm text-ink-2">{range}-day trends</p>
        </div>
        <div className="flex gap-1 rounded-control border border-line bg-bg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                range === r ? "bg-accent text-bg" : "text-ink-3 active:scale-95"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      {insights.length > 0 && (
        <section className="rounded-card border border-accent/30 bg-accent/5 p-4 shadow-card space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Insights</p>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>{ins}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-3">Correlation only — not causal. Min 4 nights required.</p>
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-4 shadow-card space-y-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Health Trends</p>
        {hasData ? (
          <>
            <div className="space-y-1.5">
              <p className="text-xs text-ink-3">Sleep score</p>
              <TrendChart data={sleepData} labels={labels} min={0} max={100} />
            </div>
            <div className="h-px bg-line" />
            <div className="space-y-1.5">
              <p className="text-xs text-ink-3">Readiness score</p>
              <TrendChart data={readyData} labels={labels} min={0} max={100} />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-3">No Oura data yet. Connect Oura in Settings to see your trends.</p>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">Last Night (Oura)</p>
        {lastNight && (lastNight.sleep_score != null || lastNight.readiness_score != null) ? (
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-control border border-line bg-bg/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Sleep</p>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">{lastNight.sleep_score ?? "—"}</p>
            </div>
            <div className="flex-1 rounded-control border border-line bg-bg/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Readiness</p>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">{lastNight.readiness_score ?? "—"}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-control border border-line bg-bg/40 p-3">
            <p className="text-sm text-ink-3">
              Connect Oura in{" "}
              <a href="/settings" className="text-accent underline-offset-2 hover:underline">Settings</a>{" "}
              to see last night's data.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
