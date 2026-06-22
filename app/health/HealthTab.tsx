"use client";

import { useState } from "react";
import TrendChart from "@/app/components/ui/TrendChart";
import CalendarHeatmap from "@/app/components/ui/CalendarHeatmap";
import CorrelationBar from "@/app/components/ui/CorrelationBar";
import type { CorrelationResult } from "@/lib/correlation-utils";

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

type HrvBaseline = { baseline_30d: number; current_7d: number } | null;

type PersonalRecords = {
  bestSleep: { day: string; score: number } | null;
  bestReadiness: { day: string; score: number } | null;
  bestHrv: { day: string; hrv: number } | null;
};

type SleepStageAvg = {
  rem_pct: number;
  deep_pct: number;
  light_pct: number;
  awake_pct: number;
  nights: number;
} | null;

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

type Alert = { severity: "warning" | "positive"; message: string; detail: string };

function detectAlerts(allDays: DayRow[], hrvBaseline: HrvBaseline, streak: number): Alert[] {
  const alerts: Alert[] = [];
  const last7 = allDays.slice(-7);

  // Consecutive low readiness (3+ days < 60)
  let lowReadinessStreak = 0;
  for (let i = last7.length - 1; i >= 0; i--) {
    if ((last7[i].readiness_score ?? 100) < 60) lowReadinessStreak++;
    else break;
  }
  if (lowReadinessStreak >= 3) {
    alerts.push({
      severity: "warning",
      message: `${lowReadinessStreak}-day low readiness streak`,
      detail: "Reduce training intensity and prioritize sleep.",
    });
  }

  // Declining sleep (3+ nights progressively worse)
  const recentSleep = last7.map((d) => d.sleep_score).filter((s): s is number => s != null);
  if (recentSleep.length >= 3) {
    const last3 = recentSleep.slice(-3);
    if (last3.slice(1).every((v, i) => v < last3[i] - 2)) {
      alerts.push({
        severity: "warning",
        message: "Sleep declining 3 nights in a row",
        detail: "Establish a consistent wind-down routine.",
      });
    }
  }

  // HRV well below baseline
  if (hrvBaseline && hrvBaseline.baseline_30d > 0 && hrvBaseline.current_7d < hrvBaseline.baseline_30d * 0.88) {
    const dropPct = Math.round(
      ((hrvBaseline.baseline_30d - hrvBaseline.current_7d) / hrvBaseline.baseline_30d) * 100,
    );
    alerts.push({
      severity: "warning",
      message: `HRV ${dropPct}% below personal baseline`,
      detail: "Nervous system under stress — prioritize recovery.",
    });
  }

  // Positive: strong sleep streak
  if (streak >= 5) {
    alerts.push({
      severity: "positive",
      message: `${streak}-day sleep streak above 75`,
      detail: "Excellent consistency. Your body is adapting well.",
    });
  }

  return alerts;
}

function weekdayLabel(day: string, total: number): string {
  if (total > 14) return day.slice(5);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, { weekday: "short" });
}

function hrvZone(baseline: number, current: number): { label: string; color: string } {
  const ratio = current / baseline;
  if (ratio >= 1.10) return { label: "Peak", color: "var(--color-accent)" };
  if (ratio >= 1.03) return { label: "Above baseline", color: "var(--color-accent-blue)" };
  if (ratio >= 0.97) return { label: "At baseline", color: "var(--color-ink-2)" };
  if (ratio >= 0.90) return { label: "Below baseline", color: "var(--color-amber)" };
  return { label: "Recovery needed", color: "var(--color-rose)" };
}

function StageBar({ label, pct, color, optimal }: { label: string; pct: number; color: string; optimal: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-3">{optimal}</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">{pct}%</span>
        </div>
      </div>
      <div className="h-[6px] w-full rounded-full overflow-hidden bg-surface-3">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function HealthTab({
  allDays,
  lastNight,
  correlations,
  streak,
  hrvBaseline,
  personalRecords,
  sleepStageAvg,
}: {
  allDays: DayRow[];
  lastNight: LastNight;
  correlations: CorrelationResult[];
  streak: number;
  hrvBaseline: HrvBaseline;
  personalRecords: PersonalRecords;
  sleepStageAvg: SleepStageAvg;
}) {
  const [range, setRange] = useState<Range>(7);

  const days = allDays.slice(-range);
  const labels = days.map((r) => weekdayLabel(r.day, days.length));
  const sleepData = days.map((r) => r.sleep_score ?? 0);
  const readyData = days.map((r) => r.readiness_score ?? 0);
  const hrvData = days.map((r) => r.hrv_avg ?? 0);
  const hasData = sleepData.some((v) => v > 0);

  const significantCorrelations = correlations.filter((r) => r.significant);

  const lastNightStats = [
    { label: "Sleep Score", val: lastNight?.sleep_score, unit: "" },
    { label: "Readiness", val: lastNight?.readiness_score, unit: "" },
    { label: "HRV", val: lastNight?.hrv_avg != null ? Math.round(lastNight.hrv_avg) : null, unit: "ms" },
    { label: "Resting HR", val: lastNight?.resting_hr != null ? Math.round(lastNight.resting_hr) : null, unit: "bpm" },
  ];
  const hasLastNight = lastNightStats.some((s) => s.val != null);

  const heatmapDays = allDays.map((d) => ({ day: d.day, score: d.readiness_score }));

  const zone = hrvBaseline ? hrvZone(hrvBaseline.baseline_30d, hrvBaseline.current_7d) : null;
  const hrvDeviation = hrvBaseline
    ? ((hrvBaseline.current_7d - hrvBaseline.baseline_30d) / hrvBaseline.baseline_30d) * 100
    : null;

  const hasRecords =
    personalRecords.bestSleep || personalRecords.bestReadiness || personalRecords.bestHrv;

  const alerts = detectAlerts(allDays, hrvBaseline, streak);

  return (
    <main className="mx-auto max-w-md space-y-4 pb-28 pt-5">
      <header className="flex items-center justify-between px-4 animate-spring-in">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Health</h1>
          {streak >= 2 && (
            <span className="flex items-center gap-1 text-[13px] font-medium text-amber">
              <span aria-hidden>🔥</span>
              <span>{streak}d streak</span>
            </span>
          )}
        </div>
        <div className="flex min-h-[44px] items-center gap-1 rounded-full border border-line bg-bg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-transform duration-150 active:scale-95 ${
                range === r ? "border border-accent bg-accent/15 text-accent" : "border border-transparent text-ink-3"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      {/* ── Signals / Alerts ─────────────────────────────────── */}
      {alerts.length > 0 && (
        <section className="mx-4 space-y-2 animate-spring-in" style={{ animationDelay: "60ms" }}>
          {alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-card border p-4 shadow-card"
              style={{
                borderColor:
                  alert.severity === "warning"
                    ? "color-mix(in oklch, var(--color-rose) 30%, transparent)"
                    : "color-mix(in oklch, var(--color-accent) 30%, transparent)",
                background:
                  alert.severity === "warning"
                    ? "color-mix(in oklch, var(--color-rose) 5%, transparent)"
                    : "color-mix(in oklch, var(--color-accent) 5%, transparent)",
              }}
            >
              <div
                className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                style={{
                  background:
                    alert.severity === "warning" ? "var(--color-rose)" : "var(--color-accent)",
                }}
              />
              <div>
                <p
                  className="text-[13px] font-semibold"
                  style={{
                    color:
                      alert.severity === "warning" ? "var(--color-rose)" : "var(--color-accent)",
                  }}
                >
                  {alert.message}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-3">{alert.detail}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── HRV Baseline & Zone ──────────────────────────────── */}
      {hrvBaseline && zone && (
        <section className="mx-4 rounded-card glass-1 p-5 animate-spring-in" style={{ animationDelay: "80ms" }}>
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">HRV Baseline</p>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-[11px] text-ink-3">7-day avg</p>
              <p className="mt-1 font-mono text-[30px] font-semibold tabular-nums text-ink leading-none">
                {Math.round(hrvBaseline.current_7d)}
                <span className="ml-1 text-[13px] font-normal text-ink-3">ms</span>
              </p>
            </div>
            <div className="pb-1">
              <p className="text-[11px] text-ink-3">30-day baseline</p>
              <p className="mt-0.5 font-mono text-[18px] font-medium tabular-nums text-ink-2">
                {Math.round(hrvBaseline.baseline_30d)}ms
              </p>
            </div>
          </div>
          <div
            className="mt-4 rounded-control px-3.5 py-2.5"
            style={{ background: `color-mix(in oklch, ${zone.color} 10%, transparent)` }}
          >
            <p className="text-[14px] font-semibold" style={{ color: zone.color }}>{zone.label}</p>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {hrvDeviation != null && (
                <>{hrvDeviation >= 0 ? "+" : ""}{hrvDeviation.toFixed(1)}% vs personal baseline</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ── Health Trends ────────────────────────────────────── */}
      <section className="mx-4 rounded-card glass-1 p-5 space-y-5 animate-spring-in" style={{ animationDelay: "160ms" }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Health Trends</p>
        {hasData ? (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Score</p>
              <TrendChart data={sleepData} labels={labels} min={0} max={100} color="var(--color-accent-blue)" threshold={75} />
            </div>
            <div className="h-px bg-line" />
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Readiness Score</p>
              <TrendChart data={readyData} labels={labels} min={0} max={100} color="var(--color-accent)" threshold={70} />
            </div>
            <div className="h-px bg-line" />
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">HRV</p>
              <TrendChart data={hrvData} labels={labels} min={0} max={120} color="var(--color-amber)" />
            </div>
          </>
        ) : (
          <p className="text-[14px] leading-relaxed text-ink-3">
            No Oura data yet. Connect Oura in Settings to see your trends.
          </p>
        )}
      </section>

      {/* ── 90-Day Readiness Calendar ────────────────────────── */}
      {heatmapDays.length > 0 && (
        <section className="mx-4 rounded-card glass-1 p-5 animate-spring-in" style={{ animationDelay: "200ms" }}>
          <CalendarHeatmap days={heatmapDays} label="90-Day Readiness" />
        </section>
      )}

      {/* ── Sleep Stage Averages ─────────────────────────────── */}
      {sleepStageAvg && (
        <section className="mx-4 rounded-card glass-1 p-5 space-y-4 animate-spring-in" style={{ animationDelay: "220ms" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Stage Averages</p>
            <span className="text-[11px] text-ink-3">{sleepStageAvg.nights} nights</span>
          </div>
          <StageBar label="REM" pct={sleepStageAvg.rem_pct} color="var(--color-accent-blue)" optimal="20–25%" />
          <StageBar label="Deep" pct={sleepStageAvg.deep_pct} color="var(--color-accent)" optimal="15–20%" />
          <StageBar label="Light" pct={sleepStageAvg.light_pct} color="var(--color-ink-3)" optimal="~55%" />
          <StageBar label="Awake" pct={sleepStageAvg.awake_pct} color="var(--color-rose)" optimal="<5%" />
        </section>
      )}

      {/* ── Last Night ───────────────────────────────────────── */}
      <section className="mx-4 rounded-card glass-1 p-5 animate-spring-in" style={{ animationDelay: "240ms" }}>
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
              <a href="/settings" className="text-accent underline-offset-2 hover:underline">Settings</a>{" "}
              to see last night&apos;s data.
            </p>
          </div>
        )}
      </section>

      {/* ── Personal Records ─────────────────────────────────── */}
      {hasRecords && (
        <section className="mx-4 rounded-card glass-1 p-5 animate-spring-in" style={{ animationDelay: "280ms" }}>
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Personal Records</p>
          <div className="grid grid-cols-3 gap-2">
            {personalRecords.bestSleep && (
              <div className="rounded-control border border-line bg-surface-2 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Sleep</p>
                <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{personalRecords.bestSleep.score}</p>
                <p className="mt-0.5 text-[10px] text-ink-3">{personalRecords.bestSleep.day.slice(5)}</p>
              </div>
            )}
            {personalRecords.bestReadiness && (
              <div className="rounded-control border border-line bg-surface-2 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Readiness</p>
                <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{personalRecords.bestReadiness.score}</p>
                <p className="mt-0.5 text-[10px] text-ink-3">{personalRecords.bestReadiness.day.slice(5)}</p>
              </div>
            )}
            {personalRecords.bestHrv && (
              <div className="rounded-control border border-line bg-surface-2 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">HRV</p>
                <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{Math.round(personalRecords.bestHrv.hrv)}</p>
                <p className="mt-0.5 text-[10px] text-ink-3">{personalRecords.bestHrv.day.slice(5)}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Insights (Correlation Bar Charts) ───────────────── */}
      {significantCorrelations.length > 0 && (
        <section className="mx-4 rounded-card glass-1 p-5 space-y-5 animate-spring-in" style={{ animationDelay: "320ms" }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Insights</p>
          {significantCorrelations.map((r, i) => (
            <div key={r.id}>
              {i > 0 && <div className="h-px bg-line mb-5" />}
              <CorrelationBar r={r} />
            </div>
          ))}
          <p className="text-[10px] text-ink-3 pt-1">Correlation only — not causal. Min 4 nights required.</p>
        </section>
      )}
    </main>
  );
}
