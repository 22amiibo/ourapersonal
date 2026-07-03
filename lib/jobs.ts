import crypto from "crypto";
import { sql } from "@/lib/db";
import { extractWithTool, MODEL } from "@/lib/anthropic";
import { briefingTool, BRIEFING_SYSTEM, BRIEFING_TONE, recoveryToneFor, weeklyNoteTool, monthlyNarrativeTool } from "@/lib/prompts";
import { syncOura } from "@/lib/oura";
import { syncCalendar } from "@/lib/calendar";
import { syncWeather } from "@/lib/weather";
import { ingestEmail } from "@/lib/articles/ingest";
import { localDateStr, daysAgoStr, daysAheadStr, weekOfStr, isMonday } from "@/lib/dates";
import { sendPushToUser } from "@/lib/push";
import { advanceFacts } from "@/lib/pipeline/facts";
import { advanceFeatureVectors } from "@/lib/pipeline/features";
import { advanceDailySummary, advanceWeeklySummary, advanceMonthlySummary, advanceEmbeddings } from "@/lib/pipeline/summaries";
import { advancePatterns, advanceAnomalies } from "@/lib/pipeline/patterns";
import { advanceInsights, evaluateInsightDecay } from "@/lib/pipeline/insights";
import { advancePredictions, evaluatePredictions } from "@/lib/pipeline/predictions";
import { semanticRetrieve, fullTextRetrieve, logRetrieval, RETRIEVAL_BUDGETS } from "@/lib/memory";
import { embedText } from "@/lib/embeddings";

export const USER_ID = 1;

export async function userTz(): Promise<string> {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

type BriefingOutput = {
  headline: string;
  key_risk: string;
  key_opportunity: string;
  important_event?: string;
  recommended_action: string;
  sources: string[];
};

export async function generateBriefing(tz: string): Promise<BriefingOutput> {
  const today = localDateStr(tz);
  const twoWeeksAhead = daysAheadStr(tz, 14);

  // Compute data_hash from five signals (spec §4.3 + annotated anomalies)
  const [ouraRow, calRow, insightRow, predRow, anomNoteRow] = await Promise.all([
    sql`SELECT COALESCE(MAX(day)::text, '') AS v FROM oura_daily WHERE user_id = ${USER_ID}`,
    sql`SELECT COALESCE(MAX(starts_at::text), '') AS v FROM calendar_events WHERE user_id = ${USER_ID} AND starts_at >= ${today}`,
    sql`SELECT COALESCE(MAX(updated_at::text), '') AS v FROM insights WHERE user_id = ${USER_ID} AND status = 'active'`,
    sql`SELECT COUNT(*)::text AS v FROM prediction_records WHERE user_id = ${USER_ID} AND evaluated_at IS NULL AND target_date >= ${today}`,
    // Degrade to '' until the user_note migration is applied in Neon.
    sql`SELECT COALESCE(MAX(note_added_at)::text, '') AS v FROM anomaly_events WHERE user_id = ${USER_ID} AND user_note IS NOT NULL`
      .catch(() => [{ v: "" }]),
  ]);
  const dataHash = crypto.createHash("sha256").update(
    [(ouraRow[0] as { v: string }).v, (calRow[0] as { v: string }).v,
     (insightRow[0] as { v: string }).v, (predRow[0] as { v: string }).v,
     (anomNoteRow[0] as { v: string }).v].join("|")
  ).digest("hex");

  // Return cached briefing when data unchanged
  const cached = await sql`
    SELECT context_window, data_hash FROM briefings
    WHERE user_id = ${USER_ID} AND briefing_date = ${today} LIMIT 1
  `;
  if (cached.length > 0) {
    const row = cached[0] as { context_window: Record<string, unknown>; data_hash: string | null };
    if (row.data_hash === dataHash) return row.context_window as BriefingOutput;
  }

  // Retrieve context from memory (spec §9) — semantic with full-text fallback
  const budget = RETRIEVAL_BUDGETS.morning_briefing;
  let memRecords = await (async () => {
    try {
      const vec = await embedText(`morning briefing health performance ${today}`);
      return await semanticRetrieve(USER_ID, vec, budget);
    } catch {
      return fullTextRetrieve(USER_ID, `health performance ${today}`, budget);
    }
  })();
  if (memRecords.length > 0) logRetrieval(USER_ID, memRecords, "morning_briefing", dataHash).catch(() => {});

  // Calendar events + predictions — chronological, not semantic
  const [calendarEvents, predictions, featureRows, readinessRows, annotatedAnomalies] = await Promise.all([
    sql`SELECT title, kind, starts_at FROM calendar_events
        WHERE user_id = ${USER_ID} AND starts_at >= ${today} AND starts_at <= ${twoWeeksAhead}
        ORDER BY starts_at ASC LIMIT 5`,
    sql`SELECT prediction_type, prediction, confidence::text, target_date::text FROM prediction_records
        WHERE user_id = ${USER_ID} AND evaluated_at IS NULL AND target_date >= ${today}
        ORDER BY target_date ASC LIMIT 3`,
    sql`SELECT wellness_score, academic_momentum, recovery_index, cognitive_load_index
        FROM daily_feature_vectors WHERE user_id = ${USER_ID} AND vector_date = ${today} LIMIT 1`,
    sql`SELECT readiness_score FROM oura_daily
        WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 1`,
    sql`SELECT metric, to_char(event_date, 'YYYY-MM-DD') AS day, direction, user_note
        FROM anomaly_events
        WHERE user_id = ${USER_ID} AND user_note IS NOT NULL
          AND event_date >= ${daysAgoStr(tz, 14)}
        ORDER BY event_date DESC LIMIT 5`.catch(() => []),
  ]);

  // Adapt the briefing's voice to today's recovery state (peak → push,
  // low → rest) without changing the underlying facts.
  const todayReadiness = (readinessRows[0] as { readiness_score: number | null } | undefined)?.readiness_score ?? null;
  const tone = recoveryToneFor(todayReadiness);
  const briefingSystem = `${BRIEFING_SYSTEM}\n\nTODAY'S RECOVERY TONE — ${BRIEFING_TONE[tone]}`;

  const dailySummaries = memRecords.filter((r) => r.source_type === "daily_summary");
  const insights = memRecords.filter((r) => r.source_type === "insight");
  const sourceTypes = [...new Set(memRecords.map((r) => r.source_type))];
  if (featureRows.length > 0) sourceTypes.push("feature_vector");

  type CalRow = { title: string; kind: string; starts_at: string };
  type PredRow = { prediction: string; confidence: string; target_date: string };

  const lines = [
    `Today is ${today}.`, "",
    "RECENT DAILY SUMMARIES:",
    ...(dailySummaries.length > 0 ? dailySummaries.map((r) => `${r.source_date}: ${r.content}`) : ["(none yet)"]),
    "", "ACTIVE INSIGHTS:",
    ...(insights.length > 0 ? insights.map((r) => `• ${r.content}`) : ["(none yet)"]),
    "", "UPCOMING EVENTS:",
    ...(calendarEvents.length > 0
      ? (calendarEvents as CalRow[]).map((e) => `${e.starts_at}: ${e.title} (${e.kind})`)
      : ["(none)"]),
    "", "ACTIVE PREDICTIONS:",
    ...(predictions.length > 0
      ? (predictions as PredRow[]).map((p) => `${p.target_date}: ${p.prediction} (confidence ${p.confidence})`)
      : ["(none)"]),
  ];
  if (annotatedAnomalies.length > 0) {
    type AnomRow = { metric: string; day: string; direction: string; user_note: string };
    lines.push("", "ANNOTATED ANOMALIES:");
    lines.push(...(annotatedAnomalies as AnomRow[]).map(
      (a) => `${a.day}: ${a.metric} unusually ${a.direction} — user note: "${a.user_note}"`,
    ));
  }
  if (featureRows.length > 0) {
    const fv = featureRows[0] as Record<string, unknown>;
    lines.push("", `TODAY'S SCORES: wellness=${fv.wellness_score}, academic=${fv.academic_momentum}, recovery=${fv.recovery_index}, cognitive_load=${fv.cognitive_load_index}`);
  }

  const out = await extractWithTool<BriefingOutput>({
    system: briefingSystem,
    userText: lines.join("\n"),
    tool: briefingTool,
    maxTokens: 1000,
  });
  if (!out.sources || out.sources.length === 0) out.sources = sourceTypes;

  await sql`
    INSERT INTO briefings
      (user_id, briefing_date, summary_text, recommendations, context_window, model_version, data_hash, generated_at)
    VALUES (${USER_ID}, ${today}, ${out.key_risk ?? ""}, ${JSON.stringify([out.recommended_action ?? ""])},
            ${JSON.stringify(out)}, ${MODEL}, ${dataHash}, NOW())
    ON CONFLICT (user_id, briefing_date) DO UPDATE
      SET summary_text = EXCLUDED.summary_text, recommendations = EXCLUDED.recommendations,
          context_window = EXCLUDED.context_window, model_version = EXCLUDED.model_version,
          data_hash = EXCLUDED.data_hash, generated_at = NOW()
  `;

  try {
    await sendPushToUser(
      USER_ID,
      "Morning briefing",
      out.headline ?? out.key_risk?.slice(0, 120) ?? "Your briefing is ready.",
      { respectQuietHours: true, tz },
    );
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

// Raw-metric all-time bests tracked outside the achievement catalog (those
// cover HRV/readiness/steps already). Lower resting HR is better; longer deep
// sleep is better.
const RECORD_METRICS: {
  metric: string;
  label: string;
  better: "lower" | "higher";
  unit: string;
  pick: (row: { resting_hr: number | null; deep_sleep_seconds: number | null }) => number | null;
}[] = [
  { metric: "resting_hr_min", label: "Lowest resting HR", better: "lower", unit: "bpm", pick: (r) => r.resting_hr },
  { metric: "deep_sleep_max", label: "Longest deep sleep", better: "higher", unit: "min", pick: (r) => r.deep_sleep_seconds },
];

async function checkPersonalRecords(tz: string): Promise<Record<string, unknown>> {
  const today = localDateStr(tz);
  const [countRows, todayRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM oura_daily WHERE user_id = ${USER_ID}`,
    sql`SELECT resting_hr::float8,
               CASE WHEN raw_payload->>'deep_sleep_seconds' ~ '^[0-9]+(\.[0-9]+)?$'
                    THEN (raw_payload->>'deep_sleep_seconds')::float8 END AS deep_sleep_seconds
        FROM oura_daily WHERE user_id = ${USER_ID} AND day = ${today}`,
  ]);
  const historyDays = Number((countRows[0] as { n: number }).n);
  const todayRow = todayRows[0] as { resting_hr: number | null; deep_sleep_seconds: number | null } | undefined;
  if (!todayRow) return { skipped: "no oura row for today" };
  const coldStartOk = historyDays >= 30;

  const updated: string[] = [];
  for (const spec of RECORD_METRICS) {
    const value = spec.pick(todayRow);
    if (value == null) continue;

    const existing = await sql`
      SELECT best_value::float8 AS best_value FROM personal_records
      WHERE user_id = ${USER_ID} AND metric = ${spec.metric}`;
    const prevBest = (existing[0] as { best_value: number } | undefined)?.best_value ?? null;

    const improved =
      prevBest == null || (spec.better === "lower" ? value < prevBest : value > prevBest);
    if (!improved) continue;

    await sql`
      INSERT INTO personal_records (user_id, metric, best_value, best_date, updated_at)
      VALUES (${USER_ID}, ${spec.metric}, ${value}, ${today}, NOW())
      ON CONFLICT (user_id, metric) DO UPDATE
        SET previous_value = personal_records.best_value,
            previous_date = personal_records.best_date,
            best_value = EXCLUDED.best_value,
            best_date = EXCLUDED.best_date,
            updated_at = NOW()`;
    updated.push(spec.metric);

    if (coldStartOk && prevBest != null) {
      const shown = spec.metric === "deep_sleep_max" ? Math.round(value / 60) : value;
      const prevShown = spec.metric === "deep_sleep_max" ? Math.round(prevBest / 60) : prevBest;
      try {
        await sendPushToUser(
          USER_ID,
          "New record!",
          `${spec.label}: ${shown} ${spec.unit} — previous best ${prevShown} ${spec.unit}.`,
          { respectQuietHours: true, tz },
        );
      } catch {}
    }
  }
  return { updated, historyDays };
}

async function checkAchievementUnlocks(tz: string): Promise<Record<string, unknown>> {
  // Imported lazily to keep the jobs ↔ achievement-stats module cycle inert.
  const [{ gatherAchievementStats }, { evaluateAchievements }] = await Promise.all([
    import("@/lib/achievement-stats"),
    import("@/lib/achievements"),
  ]);
  const stats = await gatherAchievementStats();
  const earned = evaluateAchievements(stats).filter((a) => a.unlocked);
  if (earned.length === 0) return { newUnlocks: 0 };

  const inserted = await sql`
    INSERT INTO achievement_unlocks (user_id, achievement_id)
    SELECT ${USER_ID}, x FROM unnest(${earned.map((a) => a.id)}::text[]) AS x
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id`;
  const newIds = (inserted as { achievement_id: string }[]).map((r) => r.achievement_id);

  // A flood of "new" unlocks is a first-run backfill, not a moment — stay quiet.
  if (newIds.length > 0 && newIds.length <= 3) {
    const titles = earned.filter((a) => newIds.includes(a.id)).map((a) => a.title);
    try {
      await sendPushToUser(
        USER_ID,
        newIds.length === 1 ? "Achievement unlocked" : "Achievements unlocked",
        titles.join(" · "),
        { respectQuietHours: true, tz },
      );
    } catch {}
  }
  return { newUnlocks: newIds.length };
}

export async function runDailyJob() {
  const tz = await userTz();
  const results: Record<string, unknown> = {};

  try {
    results.oura = await syncOura(USER_ID, { start: daysAgoStr(tz, 7), end: localDateStr(tz) });
  } catch (e) {
    results.oura = { error: String(e) };
  }

  // Personal records — compare today's Oura row against stored all-time bests.
  // Cold-start gate: no records until ≥30 days of history, so the first month
  // doesn't spam trivial "records". Optional table; errors degrade silently.
  try {
    results.personalRecords = await checkPersonalRecords(tz);
  } catch (e) {
    results.personalRecords = { error: String(e) };
  }

  // Achievement unlocks — evaluate the catalog server-side so a push can fire
  // the day an award is earned, not just when the Awards page is opened.
  try {
    results.achievementUnlocks = await checkAchievementUnlocks(tz);
  } catch (e) {
    results.achievementUnlocks = { error: String(e) };
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
          await sendPushToUser(USER_ID, "Low readiness today", "Readiness is low — protect your evening.", {
            respectQuietHours: true,
            tz,
          });
        }
      }
    }
  } catch {}

  try {
    results.calendar = await syncCalendar(USER_ID);
  } catch (e) {
    results.calendar = { error: String(e) };
  }

  try {
    results.weather = await syncWeather(USER_ID, { start: daysAgoStr(tz, 7), end: daysAheadStr(tz, 7) });
  } catch (e) {
    results.weather = { error: String(e) };
  }

  // Poll the newsletter mailbox for new articles (zero AI tokens). No-ops
  // gracefully when IMAP credentials are not configured.
  try {
    results.articles = await ingestEmail(USER_ID);
  } catch (e) {
    results.articles = { error: String(e) };
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
