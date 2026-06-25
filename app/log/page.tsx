import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr, daysAgoStr } from "@/lib/dates";
import LogTab, { type IntakeEntry } from "./LogTab";

export type WeeklyStats = {
  caffeine_mg: number;
  alcohol_drinks: number;
  workout_days: number;
};

export default async function LogPage() {
  const tz = await userTz();
  const today = localDateStr(tz);
  const weekAgo = daysAgoStr(tz, 6);
  const moodSince = daysAgoStr(tz, 13);

  let entries: IntakeEntry[] = [];
  let weeklyStats: WeeklyStats | null = null;
  let moodSeries: number[] = [];
  let moodToday: number | null = null;

  // Recent daily mood (one averaged point per day) for the Inputs sparkline.
  // Separate try/catch so a missing mood_logs table never breaks the page.
  try {
    const moodRows = (await sql`
      SELECT to_char(log_date, 'YYYY-MM-DD') AS date, ROUND(AVG(mood))::int AS mood
      FROM mood_logs
      WHERE user_id = ${USER_ID} AND log_date >= ${moodSince}
      GROUP BY log_date ORDER BY log_date ASC
    `) as { date: string; mood: number }[];
    moodSeries = moodRows.map((r) => Number(r.mood));
    moodToday = moodRows.find((r) => r.date === today)?.mood ?? null;
  } catch {
    // mood_logs not migrated yet — leave the mood trend empty.
  }

  try {
    const [entryRows, statsRows] = await Promise.all([
      sql`
        SELECT id, type, quantity::float8, unit, timestamp, note
        FROM intake_log
        WHERE user_id = ${USER_ID}
          AND DATE(timestamp AT TIME ZONE ${tz}) = ${today}::date
        ORDER BY timestamp DESC
      `,
      sql`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'caffeine' THEN quantity END), 0)::numeric AS caffeine_mg,
          COALESCE(SUM(CASE WHEN type = 'alcohol' THEN quantity END), 0)::numeric AS alcohol_drinks,
          COUNT(DISTINCT CASE WHEN type = 'workout' THEN DATE(timestamp AT TIME ZONE ${tz}) END) AS workout_days
        FROM intake_log
        WHERE user_id = ${USER_ID}
          AND DATE(timestamp AT TIME ZONE ${tz}) >= ${weekAgo}::date
          AND DATE(timestamp AT TIME ZONE ${tz}) <= ${today}::date
      `,
    ]);
    entries = entryRows as IntakeEntry[];
    const sr = statsRows[0] as { caffeine_mg: string; alcohol_drinks: string; workout_days: string } | undefined;
    if (sr) {
      weeklyStats = {
        caffeine_mg: Math.round(Number(sr.caffeine_mg)),
        alcohol_drinks: Number(Number(sr.alcohol_drinks).toFixed(1)),
        workout_days: Number(sr.workout_days),
      };
    }
  } catch {
    // Table doesn't exist yet; the first POST to /api/log/intake will create it
  }

  return (
    <LogTab
      initialEntries={entries}
      initialDate={today}
      weeklyStats={weeklyStats}
      moodSeries={moodSeries}
      moodToday={moodToday}
    />
  );
}
