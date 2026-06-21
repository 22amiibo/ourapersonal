import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr, daysAgoStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tz = await userTz();
    const today = localDateStr(tz);
    const fourteenAgo = daysAgoStr(tz, 14);

    const [todayRows, trendRows] = await Promise.all([
      sql`
        SELECT readiness_score, sleep_score, hrv_avg, resting_hr,
               total_sleep_seconds, raw_payload,
               (raw_payload->>'activity_score')::numeric AS activity_score
        FROM oura_daily
        WHERE user_id = ${USER_ID} AND day = ${today}
      `,
      sql`
        SELECT day, readiness_score, sleep_score, hrv_avg,
               (raw_payload->>'activity_score')::numeric AS activity_score
        FROM oura_daily
        WHERE user_id = ${USER_ID} AND day >= ${fourteenAgo}
        ORDER BY day ASC
      `,
    ]);

    type RawRow = {
      readiness_score: number | null;
      sleep_score: number | null;
      activity_score: number | null;
      hrv_avg: number | null;
      resting_hr: number | null;
      total_sleep_seconds: number | null;
      raw_payload: unknown;
    };

    const raw = todayRows[0] as RawRow | undefined;

    let temperature_deviation: number | null = null;
    let sleep_stages: { rem: number | null; deep: number | null; light: number | null; awake: number | null } | null = null;
    let readiness_contributors: Record<string, number> | null = null;
    let steps: number | null = null;
    let active_calories: number | null = null;

    if (raw?.raw_payload && typeof raw.raw_payload === "object") {
      const p = raw.raw_payload as Record<string, unknown>;
      if (typeof p.temperature_deviation === "number") temperature_deviation = p.temperature_deviation;
      if (typeof p.rem_sleep_seconds === "number" || typeof p.deep_sleep_seconds === "number") {
        sleep_stages = {
          rem: typeof p.rem_sleep_seconds === "number" ? p.rem_sleep_seconds : null,
          deep: typeof p.deep_sleep_seconds === "number" ? p.deep_sleep_seconds : null,
          light: typeof p.light_sleep_seconds === "number" ? p.light_sleep_seconds : null,
          awake: typeof p.awake_seconds === "number" ? p.awake_seconds : null,
        };
      }
      if (p.readiness_contributors && typeof p.readiness_contributors === "object") {
        readiness_contributors = p.readiness_contributors as Record<string, number>;
      }
      if (typeof p.steps === "number") steps = p.steps;
      if (typeof p.active_calories === "number") active_calories = p.active_calories;
    }

    return NextResponse.json({
      today: raw
        ? {
            readiness_score: raw.readiness_score,
            sleep_score: raw.sleep_score,
            activity_score: raw.activity_score,
            hrv_avg: raw.hrv_avg,
            resting_hr: raw.resting_hr,
            total_sleep_seconds: raw.total_sleep_seconds,
            temperature_deviation,
            sleep_stages,
            readiness_contributors,
            steps,
            active_calories,
          }
        : null,
      trend: trendRows as {
        day: string;
        readiness_score: number | null;
        sleep_score: number | null;
        activity_score: number | null;
        hrv_avg: number | null;
      }[],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
