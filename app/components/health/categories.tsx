import type { ReactNode } from "react";
import type { TrendMetric } from "@/lib/trends";

// The Health tab's category taxonomy — the single place that defines which
// metrics belong to which Apple-Health-style category, the category's identity
// color (semantic only: Sleep=blue, Recovery=teal, Activity=amber, Heart &
// Body=neutral) and its icon. Overview rows and detail screens both read this.

export type HealthCategoryKey = "sleep" | "readiness" | "activity" | "heart";

export type CategoryMetric = {
  metric: TrendMetric;
  chart: "line" | "bar"; // line = continuous score, bar = discrete daily count
};

export type HealthCategory = {
  key: HealthCategoryKey;
  label: string;
  sublabel: string;
  /** Identity tint for the icon chip; null = neutral (Heart & Body). */
  color: string | null;
  /** Line color on this category's charts. */
  chartColor: string;
  /** The metric shown as the overview row's headline + sparkline. */
  headlineMetric: TrendMetric;
  metrics: CategoryMetric[];
  icon: ReactNode;
};

const iconSvg = (children: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

export const HEALTH_CATEGORIES: HealthCategory[] = [
  {
    key: "sleep",
    label: "Sleep",
    sublabel: "Score, duration & stages",
    color: "var(--color-accent-blue)",
    chartColor: "var(--color-accent-blue)",
    headlineMetric: "sleep_score",
    metrics: [
      { metric: "sleep_score", chart: "line" },
      { metric: "sleep_hours", chart: "line" },
    ],
    icon: iconSvg(<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />),
  },
  {
    key: "readiness",
    label: "Readiness & Recovery",
    sublabel: "Recovery score & consistency",
    color: "var(--color-accent)",
    chartColor: "var(--color-accent)",
    headlineMetric: "readiness",
    metrics: [{ metric: "readiness", chart: "line" }],
    icon: iconSvg(
      <>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </>
    ),
  },
  {
    key: "activity",
    label: "Activity",
    sublabel: "Movement, steps & effort",
    color: "var(--color-amber)",
    chartColor: "var(--color-amber)",
    headlineMetric: "activity_score",
    metrics: [
      { metric: "activity_score", chart: "line" },
      { metric: "steps", chart: "bar" },
      { metric: "active_cal", chart: "bar" },
    ],
    icon: iconSvg(
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    ),
  },
  {
    key: "heart",
    label: "Heart & Body",
    sublabel: "HRV & resting heart rate",
    color: null,
    chartColor: "var(--color-accent)",
    headlineMetric: "hrv",
    metrics: [
      { metric: "hrv", chart: "line" },
      { metric: "resting_hr", chart: "line" },
    ],
    icon: iconSvg(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  },
];

export function categoryFor(key: string): HealthCategory | null {
  return HEALTH_CATEGORIES.find((c) => c.key === key) ?? null;
}

// HRV zone vs personal baseline — moved from the old HealthTab so the Heart &
// Body detail can keep the exact same zoning logic.
export function hrvZone(
  baseline: number,
  current: number
): { label: string; color: string } {
  const ratio = current / baseline;
  if (ratio >= 1.10) return { label: "Peak", color: "var(--color-accent)" };
  if (ratio >= 1.03) return { label: "Above baseline", color: "var(--color-accent-blue)" };
  if (ratio >= 0.97) return { label: "At baseline", color: "var(--color-ink-2)" };
  if (ratio >= 0.90) return { label: "Below baseline", color: "var(--color-amber)" };
  return { label: "Recovery needed", color: "var(--color-rose)" };
}
