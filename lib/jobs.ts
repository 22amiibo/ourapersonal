import { sql } from "@/lib/db";
import { extractWithTool, MODEL } from "@/lib/anthropic";
import { briefingTool, BRIEFING_SYSTEM, weeklyNoteTool } from "@/lib/prompts";
import { syncOura } from "@/lib/oura";
import { syncCalendar } from "@/lib/calendar";
import { localDateStr, daysAgoStr, daysAheadStr, weekOfStr, isMonday } from "@/lib/dates";

export const USER_ID = 1;

export async function userTz(): Promise<string> {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

// ---- Daily briefing (Claude reads only the last 7 days) ----
export async function generateBriefing(tz: string) {
  const today = localDateStr(tz);
  const weekAgo = daysAgoStr(tz, 7);
  const twoWeeksAhead = daysAheadStr(tz, 14);

  const reflections = await sql`
    SELECT r.entry_date, r.raw_text, m.confidence_level, m.topics, m.pending_work, m.blockers
    FROM reflections r LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
    WHERE r.user_id = ${USER_ID} AND r.entry_date >= ${weekAgo}
    ORDER BY r.entry_date ASC
  `;
  const oura = await sql`
    SELECT day, sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds
    FROM oura_daily WHERE user_id = ${USER_ID} AND day >= ${weekAgo} ORDER BY day ASC
  `;
  const events = await sql`
    SELECT title, kind, starts_at FROM calendar_events
    WHERE user_id = ${USER_ID} AND starts_at >= ${today} AND starts_at <= ${twoWeeksAhead}
    ORDER BY starts_at ASC
  `;

  const context = { today, reflections, oura, upcoming_events: events };

  const out = await extractWithTool<{ summary: string; recommendations: string[] }>({
    system: BRIEFING_SYSTEM,
    userText: `Data for today's briefing (today is ${today}):\n\n${JSON.stringify(context, null, 2)}`,
    tool: briefingTool,
    maxTokens: 1500,
  });

  await sql`
    INSERT INTO briefings
      (user_id, briefing_date, summary_text, recommendations, context_window, model_version, generated_at)
    VALUES (${USER_ID}, ${today}, ${out.summary}, ${JSON.stringify(out.recommendations)},
            ${JSON.stringify(context)}, ${MODEL}, NOW())
    ON CONFLICT (user_id, briefing_date) DO UPDATE
      SET summary_text = EXCLUDED.summary_text, recommendations = EXCLUDED.recommendations,
          context_window = EXCLUDED.context_window, model_version = EXCLUDED.model_version, generated_at = NOW()
  `;
  return out;
}

// ---- Weekly rollup (numbers via SQL; one short note via Claude) ----
export async function weeklyRollup(tz: string) {
  const weekOf = weekOfStr(tz);
  const weekAgo = daysAgoStr(tz, 7);

  const agg = await sql`
    SELECT
      AVG(sleep_score)::numeric(10,2)              AS sleep_avg,
      STDDEV_SAMP(total_sleep_seconds)::numeric(10,2) AS sleep_std_dev,
      AVG(hrv_avg)::numeric(10,2)                  AS hrv_avg,
      AVG(readiness_score)::numeric(10,2)          AS readiness_avg,
      AVG(resting_hr)::numeric(10,2)               AS resting_hr_avg
    FROM oura_daily WHERE user_id = ${USER_ID} AND day >= ${weekAgo}
  `;
  const conf = await sql`
    SELECT AVG(m.confidence_level)::numeric(10,2) AS confidence_avg
    FROM reflections r JOIN reflection_metadata m ON m.reflection_id = r.id
    WHERE r.user_id = ${USER_ID} AND r.entry_date >= ${weekAgo}
  `;
  const reflections = await sql`
    SELECT r.entry_date, r.raw_text FROM reflections r
    WHERE r.user_id = ${USER_ID} AND r.entry_date >= ${weekAgo} ORDER BY r.entry_date ASC
  `;

  const a = agg[0] as Record<string, string | null>;
  const c = conf[0] as { confidence_avg: string | null };

  let note = "";
  if (reflections.length > 0) {
    try {
      const out = await extractWithTool<{ notable_note: string }>({
        userText: `This week's reflections. Write one short sentence on what stood out.\n\n${JSON.stringify(reflections, null, 2)}`,
        tool: weeklyNoteTool,
        maxTokens: 200,
      });
      note = out.notable_note;
    } catch {
      note = "";
    }
  }

  await sql`
    INSERT INTO weekly_patterns
      (user_id, week_of, sleep_avg, sleep_std_dev, hrv_avg, readiness_avg, resting_hr_avg, confidence_level, notable_note, extracted_at)
    VALUES (${USER_ID}, ${weekOf}, ${a.sleep_avg}, ${a.sleep_std_dev}, ${a.hrv_avg}, ${a.readiness_avg},
            ${a.resting_hr_avg}, ${c.confidence_avg ? String(c.confidence_avg) : null}, ${note}, NOW())
    ON CONFLICT (user_id, week_of) DO UPDATE
      SET sleep_avg = EXCLUDED.sleep_avg, sleep_std_dev = EXCLUDED.sleep_std_dev, hrv_avg = EXCLUDED.hrv_avg,
          readiness_avg = EXCLUDED.readiness_avg, resting_hr_avg = EXCLUDED.resting_hr_avg,
          confidence_level = EXCLUDED.confidence_level, notable_note = EXCLUDED.notable_note, extracted_at = NOW()
  `;
}

// ---- The single daily job (run by cron, or the "Generate" button) ----
export async function runDailyJob() {
  const tz = await userTz();
  const results: Record<string, unknown> = {};

  try {
    results.oura = await syncOura(USER_ID, { start: daysAgoStr(tz, 7), end: localDateStr(tz) });
  } catch (e) {
    results.oura = { error: String(e) };
  }

  try {
    results.calendar = await syncCalendar(USER_ID);
  } catch (e) {
    results.calendar = { error: String(e) };
  }

  try {
    results.briefing = await generateBriefing(tz);
  } catch (e) {
    results.briefing = { error: String(e) };
  }

  if (isMonday(tz)) {
    try {
      await weeklyRollup(tz);
      results.weeklyRollup = "done";
    } catch (e) {
      results.weeklyRollup = { error: String(e) };
    }
  }
  return results;
}
