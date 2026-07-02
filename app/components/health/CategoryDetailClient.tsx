"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { TrendRange, TrendResult } from "@/lib/trends";
import { trendSentiment } from "@/lib/trends";
import {
  metaFor,
  formatValue,
  chartLabels,
  SENTIMENT_COLOR,
} from "@/app/components/trends/metricMeta";
import TimeRangeToggle from "@/app/components/trends/TimeRangeToggle";
import TrendPill from "@/app/components/trends/TrendPill";
import MetricBarChart from "@/app/components/trends/MetricBarChart";
import TrendChart from "@/app/components/ui/TrendChart";
import ErrorState from "@/app/components/ui/ErrorState";
import type { HealthCategory } from "./categories";

// The shared Health category detail template: back link, category title, one
// range toggle driving every metric block (line charts for continuous scores,
// bars for discrete counts), a period-comparison pill per metric, and any
// server-rendered category extras (sleep stages, heatmap, HRV baseline) below.
// Initial data is preloaded server-side for W; other ranges fetch /api/trends.

const PERIOD_LABEL: Record<TrendRange, string> = {
  D: "vs prior 2 weeks",
  W: "vs last week",
  M: "vs last month",
  Q: "vs prior 90 days",
};

// Score-type metrics get a fixed 0–100 axis so lines compare across ranges.
const SCORE_METRICS = new Set(["sleep_score", "readiness", "activity_score"]);

export default function CategoryDetailClient({
  category,
  initial,
  children,
}: {
  category: HealthCategory;
  initial: TrendResult[];
  children?: ReactNode;
}) {
  const initialRange: TrendRange = initial[0]?.range ?? "W";
  const toMap = (rs: TrendResult[]) =>
    Object.fromEntries(rs.map((r) => [r.metric, r])) as Record<string, TrendResult>;

  const [range, setRange] = useState<TrendRange>(initialRange);
  const [data, setData] = useState<Record<string, TrendResult>>(() => toMap(initial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bumped by the error state's retry to re-run the fetch for the same range.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (range === initialRange) {
      setData(toMap(initial));
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all(
      category.metrics.map((m) =>
        fetch(`/api/trends?metric=${m.metric}&range=${range}`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("trend fetch failed"))
        )
      )
    )
      .then((rs: TrendResult[]) => {
        if (!cancelled) setData(toMap(rs));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, retryTick]);

  const hasResults = category.metrics.some((m) => data[m.metric]);

  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <Link
          href="/health"
          className="flex items-center gap-0.5 text-[13px] font-medium text-accent"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Health
        </Link>
        <h1 className="mt-1 text-display font-semibold text-ink">{category.label}</h1>
      </header>

      <div className="px-4">
        <TimeRangeToggle value={range} onChange={setRange} />
      </div>

      {error && (
        <ErrorState
          className="mx-4 mt-3 animate-fade-in"
          heading="Couldn't load this range."
          body="Showing the last loaded data instead."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      )}

      {!hasResults ? (
        <div className="mx-4 mt-3 rounded-card glass-1 p-6 text-center animate-fade-in">
          <p className="text-[15px] font-semibold text-ink">No trend data yet</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Sync Oura to start seeing {category.label.toLowerCase()} trends here.
          </p>
        </div>
      ) : (
        <div
          className="mt-3 space-y-3 px-4"
          style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}
        >
          {category.metrics.map(({ metric, chart }) => {
            const r = data[metric];
            if (!r) return null;
            const meta = metaFor(metric);
            const values = r.points.map((p) => p.value);
            const hasAny = values.some((v) => v != null);
            const labels = chartLabels(r.points.map((p) => p.date), r.range);

            // Line charts skip missing days instead of drawing dips to zero.
            const lineVals: number[] = [];
            const lineLabels: string[] = [];
            r.points.forEach((p, i) => {
              if (p.value != null) {
                lineVals.push(Math.round(p.value * 10) / 10);
                lineLabels.push(labels[i]);
              }
            });

            const deltaColor = SENTIMENT_COLOR[trendSentiment(metric, r.direction)];
            const cmp =
              `${formatValue(metric, r.prevAverage, "")} → ${formatValue(metric, r.average, "")}` +
              (r.direction === "flat"
                ? " · no change"
                : ` · ${r.delta > 0 ? "+" : ""}${formatValue(metric, r.delta, "")}`);

            return (
              <section key={metric} className="rounded-card glass-1 p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  {meta.label}
                </p>
                <div className="mt-1.5 flex items-end gap-1.5">
                  <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-ink">
                    {formatValue(metric, r.average, r.unit).replace(/\s?[a-z]+$/i, "")}
                  </span>
                  {r.unit && <span className="mb-0.5 text-[13px] text-ink-3">{r.unit}</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  Average · last {r.points.length} days
                </p>
                <div className="mt-3">
                  {!hasAny ? (
                    <p className="py-6 text-center text-[13px] text-ink-3">
                      No data in this range yet.
                    </p>
                  ) : chart === "line" && lineVals.length >= 2 ? (
                    <TrendChart
                      data={lineVals}
                      labels={lineLabels}
                      color={category.chartColor}
                      {...(SCORE_METRICS.has(metric) ? { min: 0, max: 100 } : {})}
                    />
                  ) : (
                    <MetricBarChart values={values} labels={labels} accent showAxis height={140} />
                  )}
                </div>
                <div className="mt-3">
                  <TrendPill label={PERIOD_LABEL[r.range]} value={cmp} valueColor={deltaColor} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {children && <div className="mt-3 space-y-3 px-4">{children}</div>}
    </main>
  );
}
