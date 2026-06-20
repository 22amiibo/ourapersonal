"use client";

import { useState } from "react";
import TrendChart from "@/app/components/ui/TrendChart";
import type { CorrelationResult } from "@/lib/correlation-utils";
import { formatInsight } from "@/lib/correlation-utils";

type DayRow = {
  day: string;
  sleep_score: number | null;
  readiness_score: number | null;
  hrv_avg: number | null;
};

type LastNight = {
  sleep_score: number | null;
  readiness_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
} | null;

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function weekdayLabel(day: string, total: number): string {
  if (total > 14) return day.slice(5);
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
  const hrvData = days.map((r) => r.hrv_avg ?? 0);
  const hasData = sleepData.some((v) => v > 0);

  const insights = correlations.map(formatInsight).filter(Boolean);

  const lastNightStats = [
    { label: "Sleep Score",  val: lastNight?.sleep_score,   unit: "" },
    { label: "Readiness",    val: lastNight?.readiness_score, unit: "" },
    { label: "HRV",          val: lastNight?.hrv_avg != null ? Math.round(lastNight.hrv_avg) : null, unit: "ms" },
    { label: "Resting HR",   val: lastNight?.resting_hr != null ? Math.round(lastNight.resting_hr) : null, unit: "bpm" },
  ];

  const hasLastNight = lastNightStats.some((s) => s.val != null);

  return (
    <main className="mx-auto max-w-md space-y-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <header className="flex items-center justify-between px-4 animate-spring-in">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Health</h1>
        <div className="flex min-h-[44px] items-center gap-1 rounded-control border border-line bg-bg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-[8px] px-4 py-2 text-[13px] font-medium transition-all duration-150 ${
                range === r ? "bg-accent text-bg" : "text-ink-3 active:scale-95"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      {insights.length > 0 && (
        <section
          className="mx-4 rounded-card border border-accent/30 bg-accent/5 p-5 shadow-card space-y-2.5 animate-spring-in"
          style={{ animationDelay: "80ms" }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent">Insights</p>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{ins}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-3">Correlation only — not causal. Min 4 nights required.</p>
        </section>
      )}

      <section
        className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card space-y-5 animate-spring-in"
        style={{ animationDelay: "160ms" }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Health Trends</p>
        {hasData ? (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Score</p>
              <TrendChart data={sleepData} labels={labels} min={0} max={100} />
            </div>
            <div className="h-px bg-line" />
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Readiness Score</p>
              <TrendChart data={readyData} labels={labels} min={0} max={100} />
            </div>
            <div className="h-px bg-line" />
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">HRV</p>
              <TrendChart data={hrvData} labels={labels} min={0} max={120} />
            </div>
          </>
        ) : (
          <p className="text-[14px] leading-relaxed text-ink-3">
            No Oura data yet. Connect Oura in Settings to see your trends.
          </p>
        )}
      </section>

      <section
        className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in"
        style={{ animationDelay: "240ms" }}
      >
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Last Night</p>
        {hasLastNight ? (
          <div className="grid grid-cols-2 gap-2">
            {lastNightStats.map(({ label, val, unit }) => (
              <div key={label} className="rounded-control border border-line bg-surface-2 p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
                <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">
                  {val ?? "—"}
                  {val != null && unit && (
                    <span className="ml-0.5 text-[11px] font-normal text-ink-3">{unit}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-control border border-line bg-surface-2 p-3.5">
            <p className="text-[14px] leading-relaxed text-ink-3">
              Connect Oura in{" "}
              <a href="/settings" className="text-accent underline-offset-2 hover:underline">
                Settings
              </a>{" "}
              to see last night&apos;s data.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
