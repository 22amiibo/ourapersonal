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

export async function computeCorrelations(userId: number): Promise<CorrelationResult[]> {
  const [ouraRows, intakeRows] = await Promise.all([
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
  ]);

  const oura = ouraRows as OuraRow[];
  const intake = intakeRows as IntakeRow[];

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

  return results;
}
