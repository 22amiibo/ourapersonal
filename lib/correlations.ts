import { sql } from "@/lib/db";
export type { CorrelationResult } from "@/lib/correlation-utils";
import type { CorrelationResult } from "@/lib/correlation-utils";

export { formatInsight } from "@/lib/correlation-utils";

const MIN_N = 4;
const MIN_DELTA = 2;

type OuraRow = {
  day: string;
  sleep_score: number | null;
  readiness_score: number | null;
  hrv_avg: number | null;
  total_sleep_seconds: number | null;
};

type IntakeRow = {
  day: string;
  hour: number;
  type: string;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}

function correlate(
  id: string,
  label: string,
  withDays: Set<string>,
  getMetric: (row: OuraRow) => number | null,
  oura: OuraRow[],
  dayOffset: number,
): CorrelationResult {
  const withVals: number[] = [];
  const withoutVals: number[] = [];

  for (const row of oura) {
    const metric = getMetric(row);
    if (metric == null) continue;
    // intake day = oura day minus offset
    const ouraDate = row.day.slice(0, 10);
    const [y, m, d] = ouraDate.split("-").map(Number);
    const intakeDt = new Date(Date.UTC(y, m - 1, d));
    intakeDt.setUTCDate(intakeDt.getUTCDate() - dayOffset);
    const intakeDay = intakeDt.toISOString().slice(0, 10);

    if (withDays.has(intakeDay)) {
      withVals.push(metric);
    } else {
      withoutVals.push(metric);
    }
  }

  const wa = avg(withVals);
  const woa = avg(withoutVals);
  const n = withVals.length;
  const delta = wa != null && woa != null ? wa - woa : null;

  return {
    id,
    label,
    withFactor: round1(wa),
    withoutFactor: round1(woa),
    delta: round1(delta),
    n,
    significant: n >= MIN_N && delta != null && Math.abs(delta) >= MIN_DELTA,
  };
}

// Trailing-7-night sleep-debt days: for each oura day, sum the 7 nights ending
// there against an 8h/night target (same formula as the dashboard); a day is
// "high debt" when more than 3h behind. Pure JS over the already-fetched rows.
function highSleepDebtDays(oura: OuraRow[]): Set<string> {
  const asc = [...oura].sort((a, b) => (a.day < b.day ? -1 : 1));
  const out = new Set<string>();
  for (let i = 0; i < asc.length; i++) {
    const window = asc.slice(Math.max(0, i - 6), i + 1);
    const slept = window.reduce((s, r) => s + (Number(r.total_sleep_seconds) || 0), 0);
    const nights = window.filter((r) => r.total_sleep_seconds != null).length;
    if (nights >= 3 && nights * 8 * 3600 - slept > 3 * 3600) out.add(asc[i].day.slice(0, 10));
  }
  return out;
}

type ReflectionMetaRow = { day: string; topics: string[] | null; sentiment: number | null };

export async function computeCorrelations(userId: number): Promise<CorrelationResult[]> {
  const [ouraRows, intakeRows, reflectionRows] = await Promise.all([
    sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, sleep_score, readiness_score,
             hrv_avg, total_sleep_seconds
      FROM oura_daily WHERE user_id = ${userId} AND sleep_score IS NOT NULL
      ORDER BY day DESC LIMIT 180
    `,
    sql`
      SELECT DATE(timestamp)::text AS day,
             EXTRACT(HOUR FROM timestamp)::int AS hour,
             type
      FROM intake_log WHERE user_id = ${userId}
      ORDER BY timestamp DESC LIMIT 1000
    `,
    // Optional intelligence-layer table — degrade to no tag correlations.
    sql`
      SELECT to_char(r.entry_date, 'YYYY-MM-DD') AS day, m.topics, m.sentiment::float8 AS sentiment
      FROM reflections r JOIN reflection_metadata m ON m.reflection_id = r.id
      WHERE r.user_id = ${userId}
      ORDER BY r.entry_date DESC LIMIT 365
    `.catch(() => []),
  ]);

  const oura = ouraRows as OuraRow[];
  const intake = intakeRows as IntakeRow[];
  const reflections = reflectionRows as ReflectionMetaRow[];

  const alcoholDays = new Set(intake.filter((r) => r.type === "alcohol").map((r) => r.day));
  const caffeine14Days = new Set(
    intake.filter((r) => r.type === "caffeine" && r.hour >= 14).map((r) => r.day)
  );
  const lateIntakeDays = new Set(intake.filter((r) => r.hour >= 21).map((r) => r.day));
  const workoutDays = new Set(intake.filter((r) => r.type === "workout").map((r) => r.day));

  const results: CorrelationResult[] = [
    correlate("alcohol_sleep", "alcohol → sleep score", alcoholDays, (r) => r.sleep_score, oura, 1),
    correlate("alcohol_readiness", "alcohol → readiness", alcoholDays, (r) => r.readiness_score, oura, 1),
    correlate("alcohol_hrv", "alcohol → HRV", alcoholDays, (r) => r.hrv_avg, oura, 1),
    correlate("caffeine14_sleep", "late caffeine (after 2 pm) → sleep", caffeine14Days, (r) => r.sleep_score, oura, 1),
    correlate("lateintake_sleep", "late intake (after 9 pm) → sleep", lateIntakeDays, (r) => r.sleep_score, oura, 1),
    correlate("workout_readiness", "workout → next-day readiness", workoutDays, (r) => r.readiness_score, oura, 1),
    correlate("workout_hrv", "workout → next-day HRV", workoutDays, (r) => r.hrv_avg, oura, 1),
  ];

  // Readiness on high-sleep-debt days (same-day: the debt already exists).
  const debtDays = highSleepDebtDays(oura);
  if (debtDays.size >= MIN_N) {
    results.push(
      correlate("sleepdebt_readiness", "high sleep debt → readiness", debtDays, (r) => r.readiness_score, oura, 0),
    );
  }

  // Reflection tags → next-day readiness. Top 5 tags by distinct-day count,
  // each needing at least MIN_N days — bounded, no AI, tags come from the
  // already-extracted reflection_metadata.topics array.
  if (reflections.length > 0) {
    const tagDays = new Map<string, Set<string>>();
    for (const r of reflections) {
      for (const t of r.topics ?? []) {
        const tag = t.trim().toLowerCase();
        if (!tag) continue;
        const set = tagDays.get(tag) ?? new Set<string>();
        set.add(r.day);
        tagDays.set(tag, set);
      }
    }
    const topTags = [...tagDays.entries()]
      .filter(([, days]) => days.size >= MIN_N)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5);
    for (const [tag, days] of topTags) {
      results.push(
        correlate(`tag_${tag}_readiness`, `"${tag}" days → next-day readiness`, days, (r) => r.readiness_score, oura, 1),
      );
    }

    // Positive-sentiment days (AI-scored -1..1) → next-day readiness.
    const positiveDays = new Set(
      reflections.filter((r) => r.sentiment != null && r.sentiment >= 0.3).map((r) => r.day),
    );
    if (positiveDays.size >= MIN_N) {
      results.push(
        correlate("sentiment_readiness", "positive reflection → next-day readiness", positiveDays, (r) => r.readiness_score, oura, 1),
      );
    }
  }

  return results;
}
