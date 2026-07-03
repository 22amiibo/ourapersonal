import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";
import { currentDayStreak, type AchievementStats } from "@/lib/achievements";

// Gathers the numeric signals the achievement catalog scores against.
// Extracted from app/achievements/page.tsx so both the Awards page and the
// daily cron (push-on-unlock) evaluate from the same source of truth.
// Each query is isolated in try/catch so a single missing/optional table
// (mood_logs, intake_log…) degrades to 0 rather than failing the caller.

export const ZERO_ACHIEVEMENT_STATS: AchievementStats = {
  reflectionTotal: 0,
  reflectionStreak: 0,
  moodLogTotal: 0,
  nights8h: 0,
  sleep7hStreak: 0,
  sleepDebtCleared: 0,
  optimalDays: 0,
  readiness70Streak: 0,
  workoutTotal: 0,
  workoutDays: 0,
  stepDaysOver10k: 0,
  bestSteps: 0,
  briefingsTotal: 0,
  bestHrv: 0,
  bestReadiness: 0,
};

export async function gatherAchievementStats(): Promise<AchievementStats> {
  const tz = await userTz();
  const today = localDateStr(tz);
  const stats: AchievementStats = { ...ZERO_ACHIEVEMENT_STATS };

  try {
    const [tot, days] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM reflections WHERE user_id = ${USER_ID}`,
      sql`SELECT to_char(entry_date, 'YYYY-MM-DD') AS d FROM reflections
          WHERE user_id = ${USER_ID} ORDER BY entry_date DESC LIMIT 90`,
    ]);
    stats.reflectionTotal = Number((tot[0] as { n: number }).n);
    stats.reflectionStreak = currentDayStreak((days as { d: string }[]).map((r) => r.d), today);
  } catch {
    /* reflections unavailable */
  }

  try {
    const m = await sql`SELECT COUNT(*)::int AS n FROM mood_logs WHERE user_id = ${USER_ID}`;
    stats.moodLogTotal = Number((m[0] as { n: number }).n);
  } catch {
    /* mood_logs not migrated */
  }

  try {
    const a = await sql`
      SELECT
        (COUNT(*) FILTER (WHERE total_sleep_seconds >= 28800))::int AS nights8h,
        (COUNT(*) FILTER (WHERE readiness_score >= 85))::int AS optimal_days,
        COALESCE(MAX(hrv_avg), 0)::float8 AS best_hrv,
        COALESCE(MAX(readiness_score), 0)::float8 AS best_readiness
      FROM oura_daily WHERE user_id = ${USER_ID}`;
    const r = a[0] as { nights8h: number; optimal_days: number; best_hrv: number; best_readiness: number };
    stats.nights8h = Number(r.nights8h);
    stats.optimalDays = Number(r.optimal_days);
    stats.bestHrv = Math.round(Number(r.best_hrv));
    stats.bestReadiness = Math.round(Number(r.best_readiness));
  } catch {
    /* oura_daily unavailable */
  }

  try {
    const days = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS d, readiness_score, total_sleep_seconds
      FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 90`;
    const rows = days as { d: string; readiness_score: number | null; total_sleep_seconds: number | null }[];
    const ge70 = rows
      .filter((x) => x.readiness_score != null && x.readiness_score >= 70)
      .map((x) => x.d);
    stats.readiness70Streak = currentDayStreak(ge70, today);
    const ge7h = rows
      .filter((x) => x.total_sleep_seconds != null && Number(x.total_sleep_seconds) >= 25200)
      .map((x) => x.d);
    stats.sleep7hStreak = currentDayStreak(ge7h, today);
  } catch {
    /* skip */
  }

  // Isolated — the jsonb steps cast can throw on dirty payloads, so guard the
  // cast with a numeric regex and read both the 10k-day count and best day.
  try {
    const s = await sql`
      SELECT
        (COUNT(*) FILTER (WHERE (raw_payload->>'steps')::numeric >= 10000))::int AS n,
        COALESCE(MAX((raw_payload->>'steps')::numeric), 0)::int AS best
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND raw_payload->>'steps' ~ '^[0-9]+(\.[0-9]+)?$'`;
    const r = s[0] as { n: number; best: number };
    stats.stepDaysOver10k = Number(r.n);
    stats.bestSteps = Number(r.best);
  } catch {
    /* steps not present */
  }

  try {
    const d = await sql`
      SELECT COALESCE(SUM(total_sleep_seconds), 0)::bigint AS total, COUNT(*)::int AS nights
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND day >= (CURRENT_DATE - INTERVAL '7 days')
        AND total_sleep_seconds IS NOT NULL`;
    const r = d[0] as { total: number; nights: number };
    const nights = Number(r.nights);
    const debt = 7 * 8 * 3600 - Number(r.total);
    stats.sleepDebtCleared = nights >= 3 && debt <= 0 ? 1 : 0;
  } catch {
    /* skip */
  }

  try {
    const w = await sql`
      SELECT (COUNT(*) FILTER (WHERE type = 'workout'))::int AS total,
             (COUNT(DISTINCT DATE(timestamp)) FILTER (WHERE type = 'workout'))::int AS days
      FROM intake_log WHERE user_id = ${USER_ID}`;
    const r = w[0] as { total: number; days: number };
    stats.workoutTotal = Number(r.total);
    stats.workoutDays = Number(r.days);
  } catch {
    /* intake_log unavailable */
  }

  try {
    const b = await sql`SELECT COUNT(*)::int AS n FROM briefings WHERE user_id = ${USER_ID}`;
    stats.briefingsTotal = Number((b[0] as { n: number }).n);
  } catch {
    /* skip */
  }

  return stats;
}
