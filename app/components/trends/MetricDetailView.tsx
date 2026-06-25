"use client";

import { useEffect, useState } from "react";
import type { TrendMetric, TrendRange, TrendResult } from "@/lib/trends";
import { trendSentiment } from "@/lib/trends";
import { metaFor, formatValue, chartLabels, SENTIMENT_COLOR } from "./metricMeta";
import MetricBarChart from "./MetricBarChart";
import TimeRangeToggle from "./TimeRangeToggle";
import TrendPill from "./TrendPill";

function fmtDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function rangeSubtitle(points: { date: string }[]): string {
  if (points.length === 0) return "";
  const first = points[0].date;
  const last = points[points.length - 1].date;
  return first === last ? fmtDate(first) : `${fmtDate(first)} – ${fmtDate(last)}`;
}

// Detail overlay: D/W/M selector + AVERAGE + big value + date range + full bar
// chart (gridlines, axis, day labels) + Trend pill. All from computeTrends, no AI.
export default function MetricDetailView({
  metric,
  initial,
  onClose,
}: {
  metric: TrendMetric;
  initial: TrendResult;
  onClose: () => void;
}) {
  const meta = metaFor(metric);
  const [range, setRange] = useState<TrendRange>(initial.range);
  const [data, setData] = useState<TrendResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Light haptic confirmation as the sheet rises (no-op where unsupported).
  useEffect(() => {
    navigator.vibrate?.(8);
  }, []);

  useEffect(() => {
    // W is preloaded; fetch only when switching to another range.
    if (range === initial.range) {
      setData(initial);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/trends?metric=${metric}&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("trend fetch failed"))))
      .then((d: TrendResult) => {
        if (!cancelled) setData(d);
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
  }, [range, metric, initial]);

  const values = data.points.map((p) => p.value);
  const labels = chartLabels(
    data.points.map((p) => p.date),
    range,
  );
  // Explicit period-over-period comparison: prior-window average → this window,
  // with the signed delta. Label names the window so "is this better?" is clear.
  const periodLabel = range === "W" ? "vs last week" : range === "M" ? "vs last month" : "vs prior 2 weeks";
  const cmpStr =
    `${formatValue(metric, data.prevAverage, "")} → ${formatValue(metric, data.average, "")}` +
    (data.direction === "flat"
      ? " · no change"
      : ` · ${data.delta > 0 ? "+" : ""}${formatValue(metric, data.delta, "")}`);
  // Tint by metric-aware sentiment (resting-HR up = bad, HRV up = good).
  const deltaColor = SENTIMENT_COLOR[trendSentiment(metric, data.direction)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(11,12,14,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.label} detail`}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-sheet glass-2 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] no-scrollbar animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-ink">{meta.label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <TimeRangeToggle value={range} onChange={setRange} />

        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Average</p>
        <div className="flex items-end gap-1.5">
          <span className="font-mono text-[40px] font-semibold leading-none tabular-nums text-ink">
            {formatValue(metric, data.average, data.unit).replace(/\s?[a-z]+$/i, "")}
          </span>
          {data.unit && <span className="mb-1 text-[15px] text-ink-3">{data.unit}</span>}
        </div>
        <p className="mt-1 text-[13px] text-ink-3">{rangeSubtitle(data.points)}</p>

        <div
          className="mt-4"
          style={{
            opacity: loading ? 0.4 : 1,
            transition: "opacity .2s",
            viewTransitionName: `vt-chart-${metric}`,
          } as React.CSSProperties}
        >
          <MetricBarChart values={values} labels={labels} accent showAxis height={180} />
        </div>

        {error && (
          <p className="mt-3 text-center text-[12px] font-medium" style={{ color: "var(--color-rose)" }}>
            Couldn’t load this range — showing the last loaded data.
          </p>
        )}

        <div className="mt-4">
          <TrendPill label={periodLabel} value={cmpStr} valueColor={deltaColor} />
        </div>
      </div>
    </div>
  );
}
