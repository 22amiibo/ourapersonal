import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { computeCorrelations } from "@/lib/correlations";
import HealthTab from "./HealthTab";

type DayRow = {
  day: string;
  sleep_score: number | null;
  readiness_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
};

export default async function HealthPage() {
  const rows = (await sql`
    SELECT to_char(day, 'YYYY-MM-DD') AS day, sleep_score, readiness_score, hrv_avg, resting_hr
    FROM oura_daily
    WHERE user_id = ${USER_ID}
    ORDER BY day DESC
    LIMIT 90
  `) as DayRow[];

  const allDays = [...rows].reverse();
  const lastNight = allDays.length ? allDays[allDays.length - 1] : null;

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
    />
  );
}
