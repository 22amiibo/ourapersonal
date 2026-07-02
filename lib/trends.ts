// Trend computation — pure SQL/JS, never the LLM. Charts render only from
// these numbers, so token cost stays at zero regardless of data volume.
//
// Reads `oura_daily` (the app's health_days table). Typed columns cover most
// metrics; activity/steps/calories live in the `raw_payload` jsonb blob.

export type TrendMetric =
  | "readiness"
  | "sleep_score"
  | "sleep_hours"
  | "hrv"
  | "resting_hr"
  | "activity_score"
  | "steps"
  | "active_cal";

// D = trailing 14 days, W = trailing 7 days, M = trailing 30 days,
// Q = trailing 90 days. All rolling windows, NOT calendar periods (per spec).
// 6M/Y are later.
export type TrendRange = "D" | "W" | "M" | "Q";

export type TrendPoint = { date: string; value: number | null };

export type TrendResult = {
  metric: TrendMetric;
  range: TrendRange;
  points: TrendPoint[];
  average: number;
  prevAverage: number;
  delta: number;
  direction: "up" | "down" | "flat";
  daysAbove: number;
  daysBelow: number;
  unit: string;
};

// The columns computeTrends selects from oura_daily, one row per day.
type OuraRow = {
  date: string;
  readiness_score: number | string | null;
  sleep_score: number | string | null;
  total_sleep_seconds: number | string | null;
  hrv_avg: number | string | null;
  resting_hr: number | string | null;
  activity_score: number | string | null;
  steps: number | string | null;
  active_cal: number | string | null;
};

type MetricSpec = {
  unit: string;
  // Higher value is the "good" direction — labelling only, not used in math.
  higherIsBetter: boolean;
  // Extract this metric's numeric value from a selected oura_daily row.
  pick: (row: OuraRow) => number | null;
};

const num = (v: unknown): number | null =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

const METRICS: Record<TrendMetric, MetricSpec> = {
  readiness: { unit: "", higherIsBetter: true, pick: (r) => num(r.readiness_score) },
  sleep_score: { unit: "", higherIsBetter: true, pick: (r) => num(r.sleep_score) },
  sleep_hours: {
    unit: "h",
    higherIsBetter: true,
    pick: (r) => {
      const s = num(r.total_sleep_seconds);
      return s == null ? null : s / 3600;
    },
  },
  hrv: { unit: "ms", higherIsBetter: true, pick: (r) => num(r.hrv_avg) },
  resting_hr: { unit: "bpm", higherIsBetter: false, pick: (r) => num(r.resting_hr) },
  activity_score: { unit: "", higherIsBetter: true, pick: (r) => num(r.activity_score) },
  steps: { unit: "", higherIsBetter: true, pick: (r) => num(r.steps) },
  active_cal: { unit: "cal", higherIsBetter: true, pick: (r) => num(r.active_cal) },
};

const RANGE_DAYS: Record<TrendRange, number> = { D: 14, W: 7, M: 30, Q: 90 };

// |delta| within 1% of the baseline magnitude reads as "flat".
const FLAT_BAND = 0.01;

export function metricSpec(metric: TrendMetric): MetricSpec {
  const s = METRICS[metric];
  if (!s) throw new Error(`Unknown trend metric: ${metric}`);
  return s;
}

export function rangeDays(range: TrendRange): number {
  const n = RANGE_DAYS[range];
  if (!n) throw new Error(`Unknown trend range: ${range}`);
  return n;
}

export type Sentiment = "good" | "bad" | "neutral";

/**
 * Is a directional change good, bad, or neutral for this metric? Honors each
 * metric's `higherIsBetter`, so an upward move is "good" for HRV but "bad" for
 * resting HR — color must mean the same thing everywhere. Pure: the caller maps
 * the sentiment to a color (see SENTIMENT_COLOR in the trends UI).
 */
export function trendSentiment(
  metric: TrendMetric,
  direction: TrendResult["direction"],
): Sentiment {
  if (direction === "flat") return "neutral";
  const movingUp = direction === "up";
  return movingUp === metricSpec(metric).higherIsBetter ? "good" : "bad";
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Pure summary math over a window's points plus the preceding equal-length
 * window (the baseline). No DB, no LLM — unit-testable in isolation.
 *
 * - average / prevAverage ignore null points (missing days).
 * - delta = average - prevAverage; direction snaps to "flat" within FLAT_BAND.
 * - daysAbove / daysBelow count window points strictly above/below prevAverage.
 */
export function summarizeTrend(
  metric: TrendMetric,
  range: TrendRange,
  points: TrendPoint[],
  prevPoints: TrendPoint[],
  unit: string,
): TrendResult {
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const prevVals = prevPoints.map((p) => p.value).filter((v): v is number => v != null);

  const average = mean(vals);
  const prevAverage = mean(prevVals);
  const delta = round2(average - prevAverage);

  const denom = Math.abs(prevAverage) || 1;
  let direction: TrendResult["direction"] = "flat";
  if (Math.abs(delta) / denom > FLAT_BAND) direction = delta > 0 ? "up" : "down";

  let daysAbove = 0;
  let daysBelow = 0;
  for (const v of vals) {
    if (v > prevAverage) daysAbove++;
    else if (v < prevAverage) daysBelow++;
  }

  return {
    metric,
    range,
    points,
    average: round2(average),
    prevAverage: round2(prevAverage),
    delta,
    direction,
    daysAbove,
    daysBelow,
    unit,
  };
}

/**
 * Compute a metric's trend over `range` for a user, entirely in SQL/JS.
 * Pulls 2×window days so the preceding window serves as the baseline.
 * The DB import is lazy so the pure helpers above stay testable without env.
 */
export async function computeTrends(
  metric: TrendMetric,
  range: TrendRange,
  userId = 1,
): Promise<TrendResult> {
  const { sql } = await import("./db");
  const spec = metricSpec(metric);
  const n = rangeDays(range);

  const rows = (await sql`
    SELECT
      to_char(day, 'YYYY-MM-DD')              AS date,
      readiness_score,
      sleep_score,
      total_sleep_seconds,
      hrv_avg,
      resting_hr,
      (raw_payload->>'activity_score')        AS activity_score,
      (raw_payload->>'steps')                 AS steps,
      (raw_payload->>'active_calories')       AS active_cal
    FROM oura_daily
    WHERE user_id = ${userId}
      AND day >  (CURRENT_DATE - ${2 * n}::int)
      AND day <= CURRENT_DATE
    ORDER BY day ASC
  `) as OuraRow[];

  const all: TrendPoint[] = rows.map((r) => ({ date: r.date, value: spec.pick(r) }));
  const points = all.slice(-n);
  const prevPoints = all.slice(0, Math.max(0, all.length - n));
  return summarizeTrend(metric, range, points, prevPoints, spec.unit);
}
