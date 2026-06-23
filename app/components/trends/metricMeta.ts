import type { TrendMetric, TrendRange } from "@/lib/trends";

export type MetricMeta = { metric: TrendMetric; label: string; noun: string };

// The metrics surfaced on the Trends tab, in display order.
export const TREND_METRICS: MetricMeta[] = [
  { metric: "readiness", label: "Readiness", noun: "readiness score" },
  { metric: "sleep_score", label: "Sleep Score", noun: "sleep score" },
  { metric: "sleep_hours", label: "Sleep Duration", noun: "time asleep" },
  { metric: "hrv", label: "HRV", noun: "HRV" },
  { metric: "resting_hr", label: "Resting HR", noun: "resting heart rate" },
  { metric: "activity_score", label: "Activity", noun: "activity score" },
  { metric: "steps", label: "Steps", noun: "step count" },
];

export function metaFor(metric: TrendMetric): MetricMeta {
  return TREND_METRICS.find((m) => m.metric === metric) ?? { metric, label: metric, noun: metric };
}

// Format a metric value for display (e.g. "7.5h", "45 ms", "8,421", "84").
export function formatValue(metric: TrendMetric, v: number, unit: string): string {
  if (metric === "steps") return Math.round(v).toLocaleString();
  if (metric === "sleep_hours") return `${v.toFixed(1)}${unit}`;
  const r = Math.round(v);
  return unit ? `${r} ${unit}` : String(r);
}

// Single-letter weekday for a YYYY-MM-DD date (Sun..Sat → S M T W T F S).
export function weekdayLetter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return "SMTWTFS"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

// Day-of-month label (e.g. "14") for sparse axis labelling.
export function dayOfMonth(date: string): string {
  return String(Number(date.split("-")[2]));
}

// Choose chart labels by range: weekday letters for D/W, sparse dates for M.
export function chartLabels(dates: string[], range: TrendRange): string[] {
  if (range === "M") {
    const step = Math.ceil(dates.length / 6);
    return dates.map((d, i) => (i % step === 0 ? dayOfMonth(d) : ""));
  }
  return dates.map(weekdayLetter);
}
