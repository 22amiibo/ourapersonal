import { sql } from "@/lib/db";
import { extractWithTool, MODEL } from "@/lib/anthropic";
import { briefingTool, BRIEFING_SYSTEM, weeklyNoteTool, monthlyNarrativeTool } from "@/lib/prompts";
import { syncOura } from "@/lib/oura";
import { syncCalendar } from "@/lib/calendar";
import { localDateStr, daysAgoStr, daysAheadStr, weekOfStr, isMonday } from "@/lib/dates";
import { sendPushToUser } from "@/lib/push";
import { advanceFacts } from "@/lib/pipeline/facts";
import { advanceFeatureVectors } from "@/lib/pipeline/features";
import { advanceDailySummary, advanceWeeklySummary, advanceMonthlySummary, advanceEmbeddings } from "@/lib/pipeline/summaries";
// The following stages are implemented by Agent 3 (patterns / insights / predictions).
import { advancePatterns, advanceAnomalies } from "@/lib/pipeline/patterns";
import { advanceInsights, evaluateInsightDecay } from "@/lib/pipeline/insights";
import { advancePredictions, evaluatePredictions } from "@/lib/pipeline/predictions";

export const USER_ID = 1;

export async function userTz(): Promise<string> {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

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

  const out = await extractWithTool<{ headline: string; summary: string; actions: string[] }>({
    system: BRIEFING_SYSTEM,
    userText: `Data for today's briefing (today is ${today}):\n\n${JSON.stringify(context, null, 2)}`,
    tool: briefingTool,
    maxTokens: 1500,
  });

  await sql`
    INSERT INTO briefings
      (user_id, briefing_date, summary_text, recommendations, context_window, model_version, generated_at)
    VALUES (${USER_ID}, ${today}, ${out.summary}, ${JSON.stringify(out.actions ?? [])},
            ${JSON.stringify({ ...context, headline: out.headline })}, ${MODEL}, NOW())
    ON CONFLICT (user_id, briefing_date) DO UPDATE
      SET summary_text = EXCLUDED.summary_text, recommendations = EXCLUDED.recommendations,
          context_window = EXCLUDED.context_window, model_version = EXCLUDED.model_version, generated_at = NOW()
  `;

  try {
    const pushBody = out.headline ?? out.summary?.slice(0, 120) ?? "Your morning briefing is ready.";
    await sendPushToUser(USER_ID, "Morning briefing", pushBody);
  } catch {}

  return out;
}

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

export async function monthlyNarrative(tz: string) {
  const today = localDateStr(tz);
  const monthAgo = daysAgoStr(tz, 30);

  const oura = await sql`
    SELECT day, sleep_score, readiness_score, hrv_avg, resting_hr
    FROM oura_daily WHERE user_id = ${USER_ID} AND day >= ${monthAgo} ORDER BY day ASC
  `;
  const reflections = await sql`
    SELECT r.entry_date, r.raw_text, m.confidence_level FROM reflections r
    LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
    WHERE r.user_id = ${USER_ID} AND r.entry_date >= ${monthAgo} ORDER BY r.entry_date ASC
  `;

  if (oura.length < 7) return;

  const out = await extractWithTool<{ narrative: string }>({
    userText: `Monthly health and reflection data (past 30 days ending ${today}):\n\n${JSON.stringify({ oura, reflections }, null, 2)}`,
    tool: monthlyNarrativeTool,
    maxTokens: 600,
  });

  const monthOf = `${today.slice(0, 7)}-01`;
  await sql`
    INSERT INTO narratives (user_id, month_of, narrative, model_ver, created_at)
    VALUES (${USER_ID}, ${monthOf}, ${out.narrative}, ${MODEL}, NOW())
    ON CONFLICT (user_id, month_of) DO UPDATE
      SET narrative = EXCLUDED.narrative, model_ver = EXCLUDED.model_ver, created_at = NOW()
  `;
}

function isFirstOfMonth(tz: string): boolean {
  return localDateStr(tz).endsWith("-01");
}

export async function runDailyJob() {
  const tz = await userTz();
  const results: Record<string, unknown> = {};

  try {
    results.oura = await syncOura(USER_ID, { start: daysAgoStr(tz, 7), end: localDateStr(tz) });
  } catch (e) {
    results.oura = { error: String(e) };
  }

  // Check readiness drop vs 7-day average
  try {
    const today = localDateStr(tz);
    const weekAgo = daysAgoStr(tz, 7);
    const readinessRows = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, readiness_score
      FROM oura_daily WHERE user_id = ${USER_ID} AND day >= ${weekAgo} AND day <= ${today}
      ORDER BY day DESC
    `;
    if (readinessRows.length >= 2) {
      const todayRow = readinessRows[0] as { day: string; readiness_score: number | null };
      const prevRows = (readinessRows.slice(1) as { readiness_score: number | null }[]).filter(
        (r) => r.readiness_score != null
      );
      if (prevRows.length > 0 && todayRow.readiness_score != null) {
        const avgPrev = prevRows.reduce((s, r) => s + r.readiness_score!, 0) / prevRows.length;
        if (todayRow.readiness_score <= avgPrev - 15) {
          await sendPushToUser(USER_ID, "Low readiness today", "Readiness is low — protect your evening.");
        }
      }
    }
  } catch {}

  try {
    results.calendar = await syncCalendar(USER_ID);
  } catch (e) {
    results.calendar = { error: String(e) };
  }

  // Cursor-based processing pipeline (statistics → rules → LLM).
  try { await advanceFacts(USER_ID, tz); results.facts = "done"; } catch (e) { results.facts = { error: String(e) }; }
  try { await advanceFeatureVectors(USER_ID, tz); results.featureVectors = "done"; } catch (e) { results.featureVectors = { error: String(e) }; }
  try { await advanceDailySummary(USER_ID, tz); results.dailySummary = "done"; } catch (e) { results.dailySummary = { error: String(e) }; }
  try { await advanceEmbeddings(USER_ID); results.embeddings = "done"; } catch (e) { results.embeddings = { error: String(e) }; }
  try { await advanceAnomalies(USER_ID); results.anomalies = "done"; } catch (e) { results.anomalies = { error: String(e) }; }
  try { await advancePatterns(USER_ID); results.patterns = "done"; } catch (e) { results.patterns = { error: String(e) }; }
  try { await advanceInsights(USER_ID); results.insights = "done"; } catch (e) { results.insights = { error: String(e) }; }
  try { await advancePredictions(USER_ID, tz); results.predictions = "done"; } catch (e) { results.predictions = { error: String(e) }; }
  try { await evaluatePredictions(USER_ID); results.predictionEval = "done"; } catch (e) { results.predictionEval = { error: String(e) }; }

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
    try { await advanceWeeklySummary(USER_ID, tz); results.weeklySummary = "done"; } catch (e) { results.weeklySummary = { error: String(e) }; }
  }

  if (isFirstOfMonth(tz)) {
    try {
      await monthlyNarrative(tz);
      results.monthlyNarrative = "done";
    } catch (e) {
      results.monthlyNarrative = { error: String(e) };
    }
    try { await advanceMonthlySummary(USER_ID, tz); results.monthlySummary = "done"; } catch (e) { results.monthlySummary = { error: String(e) }; }
    try { await evaluateInsightDecay(USER_ID); results.insightDecay = "done"; } catch (e) { results.insightDecay = { error: String(e) }; }
  }

  return results;
}
