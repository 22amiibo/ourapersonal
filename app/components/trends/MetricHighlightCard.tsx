"use client";

import type { TrendResult } from "@/lib/trends";
import { metaFor, formatValue, weekdayLetter } from "./metricMeta";
import MetricBarChart from "./MetricBarChart";

// Apple-Health "Highlights" card: headline sentence + mini bars with the
// window's own average line + days-above-baseline. Tap opens the detail view.
export default function MetricHighlightCard({
  result,
  onOpen,
}: {
  result: TrendResult;
  onOpen: () => void;
}) {
  const meta = metaFor(result.metric);
  const values = result.points.map((p) => p.value);
  const labels = result.points.map((p) => weekdayLetter(p.date));
  const total = result.points.length;

  const dirWord =
    result.direction === "flat" ? "in line with" : result.direction === "up" ? "above" : "below";

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
        {" "}— {dirWord} your baseline.
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
        <div className="mt-2">
          <MetricBarChart values={values} labels={labels} average={result.average} height={92} />
        </div>
      </div>

      <p className="mt-1 text-[12px] text-ink-3">
        {result.daysAbove} of {total} days above baseline · {result.daysBelow} below
      </p>
    </button>
  );
}
