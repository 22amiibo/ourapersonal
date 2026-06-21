import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { computeCorrelations } from "@/lib/correlations";
import { daysAgoStr } from "@/lib/dates";
import HealthTab from "./HealthTab";

type DayRow = {
  day: string;
  sleep_score: number | null;
  readiness_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
};

type StageRow = {
  rem_s: number | null;
  deep_s: number | null;
  light_s: number | null;
  awake_s: number | null;
  total_sleep_seconds: number | null;
};

const STREAK_THRESHOLD = 75;

function computeStreak(days: DayRow[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i].sleep_score;
    if (s != null && s >= STREAK_THRESHOLD) streak++;
    else break;
  }
  return streak;
}

function avgSleepStages(rows: StageRow[]) {
  const valid = rows.filter(
    (r) => r.total_sleep_seconds != null && Number(r.total_sleep_seconds) > 0
  );
  if (valid.length < 3) return null;
  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v != null).map(Number);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };
  const totalAvg = avg(valid.map((r) => r.total_sleep_seconds));
  if (!totalAvg) return null;
  return {
    rem_pct: Math.round((avg(valid.map((r) => r.rem_s)) / totalAvg) * 100),
    deep_pct: Math.round((avg(valid.map((r) => r.deep_s)) / totalAvg) * 100),
    light_pct: Math.round((avg(valid.map((r) => r.light_s)) / totalAvg) * 100),
    awake_pct: Math.round((avg(valid.map((r) => r.awake_s)) / totalAvg) * 100),
    nights: valid.length,
  };
}

export default async function HealthPage() {
  const thirtyAgo = daysAgoStr("UTC", 30);
  const sevenAgo = daysAgoStr("UTC", 7);

  const [rows, hrvRows, bestSleepRows, bestReadinessRows, bestHrvRows, stageRows] =
    await Promise.all([
      sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, sleep_score, readiness_score, hrv_avg, resting_hr
        FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 90
      `,
      sql`
        SELECT
          AVG(hrv_avg) FILTER (WHERE day >= ${thirtyAgo}::date)::numeric AS baseline_30d,
          AVG(hrv_avg) FILTER (WHERE day >= ${sevenAgo}::date)::numeric AS current_7d
        FROM oura_daily WHERE user_id = ${USER_ID} AND hrv_avg IS NOT NULL
      `,
      sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, sleep_score AS score
        FROM oura_daily WHERE user_id = ${USER_ID} AND sleep_score IS NOT NULL
        ORDER BY sleep_score DESC LIMIT 1
      `,
      sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, readiness_score AS score
        FROM oura_daily WHERE user_id = ${USER_ID} AND readiness_score IS NOT NULL
        ORDER BY readiness_score DESC LIMIT 1
      `,
      sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, hrv_avg::numeric AS hrv
        FROM oura_daily WHERE user_id = ${USER_ID} AND hrv_avg IS NOT NULL
        ORDER BY hrv_avg DESC LIMIT 1
      `,
      sql`
        SELECT
          (raw_payload->>'rem_sleep_seconds')::numeric AS rem_s,
          (raw_payload->>'deep_sleep_seconds')::numeric AS deep_s,
          (raw_payload->>'light_sleep_seconds')::numeric AS light_s,
          (raw_payload->>'awake_seconds')::numeric AS awake_s,
          total_sleep_seconds
        FROM oura_daily
        WHERE user_id = ${USER_ID}
          AND total_sleep_seconds > 0
          AND raw_payload->>'rem_sleep_seconds' IS NOT NULL
        ORDER BY day DESC LIMIT 30
      `,
    ]);

  const allDays = (rows as DayRow[]).reverse();
  const lastNight = allDays.length ? allDays[allDays.length - 1] : null;
  const streak = computeStreak(allDays);

  const hrv = hrvRows[0] as { baseline_30d: number | null; current_7d: number | null } | undefined;
  const hrvBaseline =
    hrv?.baseline_30d != null && hrv?.current_7d != null
      ? { baseline_30d: Number(hrv.baseline_30d), current_7d: Number(hrv.current_7d) }
      : null;

  type RecordRow = { day: string; score: number } | undefined;
  type HrvRecordRow = { day: string; hrv: number } | undefined;
  const bestSleep = (bestSleepRows[0] as RecordRow) ?? null;
  const bestReadiness = (bestReadinessRows[0] as RecordRow) ?? null;
  const bestHrv = (bestHrvRows[0] as HrvRecordRow) ?? null;

  const sleepStageAvg = avgSleepStages(stageRows as StageRow[]);

  let correlations: Awaited<ReturnType<typeof computeCorrelations>> = [];
  try {
    correlations = await computeCorrelations(USER_ID);
  } catch {
    correlations = [];
  }

  return (
    <HealthTab
      allDays={allDays}
      lastNight={lastNight}
      correlations={correlations}
      streak={streak}
      hrvBaseline={hrvBaseline}
      personalRecords={{ bestSleep, bestReadiness, bestHrv: bestHrv ? { day: bestHrv.day, hrv: Number(bestHrv.hrv) } : null }}
      sleepStageAvg={sleepStageAvg}
    />
  );
}
