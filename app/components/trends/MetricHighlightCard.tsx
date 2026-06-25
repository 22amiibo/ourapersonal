"use client";

import type { TrendResult } from "@/lib/trends";
import { trendSentiment } from "@/lib/trends";
import { metaFor, formatValue, weekdayLetter, daysSince, SENTIMENT_COLOR } from "./metricMeta";
import MetricBarChart from "./MetricBarChart";

// Apple-Health "Highlights" card: headline sentence + mini bars with the
// window's own average line + days-above-baseline. Tap opens the detail view.
export default function MetricHighlightCard({
  result,
  onOpen,
  active = false,
}: {
  result: TrendResult;
  onOpen: () => void;
  // While this card's detail is open, it yields its shared-element name to the
  // detail sheet so exactly one element owns the name during the transition.
  active?: boolean;
}) {
  const meta = metaFor(result.metric);
  const values = result.points.map((p) => p.value);
  const labels = result.points.map((p) => weekdayLetter(p.date));
  const total = result.points.length;

  // Stale-data honesty: how old is the freshest real value? ≥2 days reads as a
  // sync gap worth flagging so the average isn't mistaken for "as of today".
  const lastReal = [...result.points].reverse().find((p) => p.value != null);
  const ageDays = lastReal ? daysSince(lastReal.date) : null;
  const stale = ageDays != null && ageDays >= 2;

  const dirWord =
    result.direction === "flat" ? "in line with" : result.direction === "up" ? "above" : "below";
  // Color the direction by sentiment, not raw direction: "below" is good for
  // resting HR but bad for HRV. Honors each metric's higherIsBetter.
  const dirColor = SENTIMENT_COLOR[trendSentiment(result.metric, result.direction)];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-card glass-1 p-5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
        <span className="text-[13px] font-semibold text-accent">{meta.label}</span>
      </div>

      <p className="mt-2 text-[16px] font-semibold leading-snug text-ink">
        The last 7 days, your {meta.noun} averaged {formatValue(result.metric, result.average, result.unit)}
        {" "}— <span style={{ color: dirColor }}>{dirWord}</span> your baseline.
      </p>

      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Average {meta.noun}
        </p>
        <div className="mt-1 flex items-end gap-1">
          <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-ink">
            {formatValue(result.metric, result.average, result.unit)}
          </span>
        </div>
        <div
          className="mt-2"
          style={{ viewTransitionName: active ? undefined : `vt-chart-${result.metric}` } as React.CSSProperties}
        >
          <MetricBarChart values={values} labels={labels} average={result.average} height={92} />
        </div>
      </div>

      <p className="mt-1 text-[12px] text-ink-3">
        {result.daysAbove} of {total} days above baseline · {result.daysBelow} below
      </p>
      {stale && (
        <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--color-amber)" }}>
          Last value {ageDays}d ago — may be out of date
        </p>
      )}
    </button>
  );
}
