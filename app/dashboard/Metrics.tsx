"use client";

import { useEffect, useState } from "react";
import ChartContainer from "@/app/components/ui/ChartContainer";
import Sparkline from "@/app/components/ui/Sparkline";

type OuraToday = {
  readiness_score: number | null;
  sleep_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  total_sleep_seconds: number | null;
  temperature_deviation: number | null;
};

type TrendDay = {
  day: string;
  readiness_score: number | null;
  sleep_score: number | null;
  hrv_avg: number | null;
};

type OuraData = { today: OuraToday | null; trend: TrendDay[] };

// Placeholder trend data shown when real data isn't available yet
const STUB_READINESS = [72, 75, 68, 80, 77, 82, 78, 85, 74, 79, 83, 76, 81, 80];
const STUB_SLEEP = [65, 70, 72, 68, 75, 73, 78, 71, 74, 76, 72, 79, 74, 77];
const STUB_HRV = [42, 45, 40, 48, 44, 50, 46, 52, 43, 47, 51, 44, 49, 48];

function fmt(v: number | null, decimals = 0): string {
  return v == null ? "—" : v.toFixed(decimals);
}

function fmtSleep(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtTemp(v: number | null): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

const METRICS: {
  key: keyof OuraToday;
  label: string;
  unit: string;
  format: (v: number | null) => string;
}[] = [
  { key: "readiness_score", label: "Readiness",    unit: "/100", format: fmt },
  { key: "sleep_score",     label: "Sleep Score",  unit: "/100", format: fmt },
  { key: "hrv_avg",         label: "HRV",          unit: "ms",   format: fmt },
  { key: "resting_hr",      label: "Resting HR",   unit: "bpm",  format: fmt },
  { key: "total_sleep_seconds", label: "Duration", unit: "",     format: fmtSleep },
  { key: "temperature_deviation", label: "Body Temp", unit: "°C", format: fmtTemp },
];

function SkeletonCard() {
  return <div className="h-16 rounded-card bg-surface-2 animate-pulse" />;
}

export default function Metrics() {
  const [data, setData] = useState<OuraData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/oura")
      .then((r) => r.json())
      .then((d: OuraData) => setData(d))
      .catch(() => setData({ today: null, trend: [] }))
      .finally(() => setLoading(false));
  }, []);

  const nonNull = <T,>(arr: (T | null)[]): T[] =>
    arr.filter((v): v is T => v !== null);

  const readinessTrend = nonNull(data?.trend.map((d) => d.readiness_score) ?? []);
  const sleepTrend     = nonNull(data?.trend.map((d) => d.sleep_score) ?? []);
  const hrvTrend       = nonNull(data?.trend.map((d) => d.hrv_avg) ?? []);

  return (
    <>
      {/* Today's metrics */}
      <section>
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-ink-3">
          Today's metrics
        </p>
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : data?.today ? (
          <div className="grid grid-cols-2 gap-2.5">
            {METRICS.map(({ key, label, unit, format }) => {
              const v = data.today![key] as number | null;
              return (
                <div
                  key={key}
                  className="rounded-card border border-line bg-surface p-3.5 shadow-card"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">
                    {label}
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-medium tabular-nums text-ink">
                    {format(v)}
                    {v != null && unit && (
                      <span className="ml-1 text-xs font-normal text-ink-3">{unit}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-sm text-ink-3">
              No data for today. Connect Oura in Settings, then sync.
            </p>
          </div>
        )}
      </section>

      {/* 14-Day Trends */}
      <ChartContainer title="14-Day Trends" meta="Past 14 days">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded animate-pulse bg-line" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-ink-3">Readiness</p>
              <Sparkline
                values={readinessTrend.length >= 2 ? readinessTrend : STUB_READINESS}
              />
            </div>
            <div className="space-y-1 border-t border-line pt-3.5">
              <p className="text-xs text-ink-3">Sleep Score</p>
              <Sparkline
                values={sleepTrend.length >= 2 ? sleepTrend : STUB_SLEEP}
                color="var(--color-amber)"
              />
            </div>
            <div className="space-y-1 border-t border-line pt-3.5">
              <p className="text-xs text-ink-3">HRV</p>
              <Sparkline
                values={hrvTrend.length >= 2 ? hrvTrend : STUB_HRV}
                color="var(--color-rose)"
              />
            </div>
          </div>
        )}
      </ChartContainer>
    </>
  );
}
