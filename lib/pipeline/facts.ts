import { sql } from "@/lib/db";
import { extractWithTool, HAIKU_MODEL } from "@/lib/anthropic";
import { dailyFactsExtractionTool } from "@/lib/prompts";
import { daysAgoStr } from "@/lib/dates";

// -------------------------------------------------------------
// Cursor helpers (shared shape used by every pipeline stage)
// -------------------------------------------------------------

export async function getCursor(userId: number, stage: string): Promise<string | null> {
  const rows = await sql`
    SELECT to_char(processed_through, 'YYYY-MM-DD') AS processed_through
    FROM processing_cursors
    WHERE user_id = ${userId} AND pipeline_stage = ${stage}
  `;
  return (rows[0] as { processed_through: string | null } | undefined)?.processed_through ?? null;
}

export async function setCursor(userId: number, stage: string, date: string): Promise<void> {
  await sql`
    INSERT INTO processing_cursors (user_id, pipeline_stage, processed_through, last_run, status, error_message)
    VALUES (${userId}, ${stage}, ${date}, NOW(), 'idle', NULL)
    ON CONFLICT (user_id, pipeline_stage) DO UPDATE
      SET processed_through = EXCLUDED.processed_through, last_run = NOW(),
          status = 'idle', error_message = NULL
  `;
}

export async function setError(userId: number, stage: string, msg: string): Promise<void> {
  await sql`
    INSERT INTO processing_cursors (user_id, pipeline_stage, last_run, status, error_count, error_message)
    VALUES (${userId}, ${stage}, NOW(), 'error', 1, ${msg})
    ON CONFLICT (user_id, pipeline_stage) DO UPDATE
      SET last_run = NOW(), status = 'error',
          error_count = processing_cursors.error_count + 1,
          error_message = ${msg}
  `;
}

// -------------------------------------------------------------
// Date utilities
// -------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// -------------------------------------------------------------
// Deterministic fact insert (idempotent — no unique constraint
// exists in the schema, so we guard with NOT EXISTS on the tuple
// user_id + fact_date + fact_type + source).
// -------------------------------------------------------------

async function insertFact(opts: {
  userId: number;
  date: string;
  factType: string;
  source: string;
  lifeArea: string;
  valueNum?: number | null;
  valueText?: string | null;
  confidence?: number;
}): Promise<void> {
  const valueNum = opts.valueNum ?? null;
  const valueText = opts.valueText ?? null;
  const confidence = opts.confidence ?? 1.0;
  await sql`
    INSERT INTO daily_facts (user_id, fact_date, fact_type, source, life_area, value_num, value_text, confidence)
    SELECT ${opts.userId}, ${opts.date}, ${opts.factType}, ${opts.source}, ${opts.lifeArea},
           ${valueNum}, ${valueText}, ${confidence}
    WHERE NOT EXISTS (
      SELECT 1 FROM daily_facts
      WHERE user_id = ${opts.userId} AND fact_date = ${opts.date}
        AND fact_type = ${opts.factType} AND source = ${opts.source}
    )
  `;
}

// -------------------------------------------------------------
// Per-date processing
// -------------------------------------------------------------

async function deterministicFacts(userId: number, date: string): Promise<void> {
  // Oura-derived facts
  const ouraRows = await sql`
    SELECT readiness_score, hrv_avg, total_sleep_seconds
    FROM oura_daily WHERE user_id = ${userId} AND day = ${date}
  `;
  const oura = ouraRows[0] as
    | { readiness_score: number | null; hrv_avg: number | null; total_sleep_seconds: number | null }
    | undefined;

  if (oura) {
    if (oura.total_sleep_seconds != null) {
      const sleepHours = oura.total_sleep_seconds / 3600;
      if (sleepHours < 7) {
        await insertFact({ userId, date, factType: "sleep_under_7h", source: "oura", lifeArea: "sleep", valueNum: sleepHours });
      }
      if (sleepHours >= 8) {
        await insertFact({ userId, date, factType: "sleep_over_8h", source: "oura", lifeArea: "sleep", valueNum: sleepHours });
      }
    }
    if (oura.readiness_score != null) {
      if (oura.readiness_score < 60) {
        await insertFact({ userId, date, factType: "readiness_anomaly_low", source: "oura", lifeArea: "recovery", valueNum: oura.readiness_score });
      }
      if (oura.readiness_score >= 90) {
        await insertFact({ userId, date, factType: "readiness_anomaly_high", source: "oura", lifeArea: "recovery", valueNum: oura.readiness_score });
      }
    }
    // HRV anomaly vs trailing 30-day mean/stddev
    if (oura.hrv_avg != null) {
      const statsRows = await sql`
        SELECT AVG(hrv_avg)::float AS mean, STDDEV_SAMP(hrv_avg)::float AS sd
        FROM oura_daily
        WHERE user_id = ${userId} AND hrv_avg IS NOT NULL
          AND day >= ${addDays(date, -30)} AND day < ${date}
      `;
      const stats = statsRows[0] as { mean: number | null; sd: number | null };
      if (stats.mean != null && stats.sd != null && stats.sd > 0) {
        if (oura.hrv_avg < stats.mean - 2 * stats.sd) {
          await insertFact({ userId, date, factType: "hrv_anomaly_low", source: "oura", lifeArea: "recovery", valueNum: oura.hrv_avg });
        }
      }
    }
  }

  // Intake-derived facts
  const intakeRows = await sql`
    SELECT type, EXTRACT(HOUR FROM timestamp)::int AS hr
    FROM intake_log
    WHERE user_id = ${userId} AND timestamp::date = ${date}
  `;
  const intake = intakeRows as { type: string; hr: number }[];
  if (intake.some((r) => r.type === "alcohol")) {
    await insertFact({ userId, date, factType: "alcohol_day", source: "intake", lifeArea: "nutrition" });
  }
  if (intake.some((r) => r.type === "caffeine" && r.hr >= 14)) {
    await insertFact({ userId, date, factType: "caffeine_after_14", source: "intake", lifeArea: "nutrition" });
  }
  if (intake.some((r) => r.type === "workout")) {
    await insertFact({ userId, date, factType: "workout_day", source: "intake", lifeArea: "fitness" });
  }

  // Academic calendar facts
  const examTodayRows = await sql`
    SELECT 1 FROM academic_events WHERE user_id = ${userId} AND event_date = ${date} LIMIT 1
  `;
  if (examTodayRows.length > 0) {
    await insertFact({ userId, date, factType: "exam_today", source: "calendar", lifeArea: "academics" });
  }
  const examTomorrowRows = await sql`
    SELECT 1 FROM academic_events WHERE user_id = ${userId} AND event_date = ${addDays(date, 1)} LIMIT 1
  `;
  if (examTomorrowRows.length > 0) {
    await insertFact({ userId, date, factType: "exam_tomorrow", source: "calendar", lifeArea: "academics" });
  }
}

async function reflectionFacts(userId: number, date: string): Promise<void> {
  const rows = await sql`
    SELECT raw_text FROM reflections WHERE user_id = ${userId} AND entry_date = ${date}
  `;
  const raw = (rows[0] as { raw_text: string | null } | undefined)?.raw_text;
  if (!raw || raw.length === 0) return;

  // Skip if reflection facts already extracted for this date.
  const existing = await sql`
    SELECT 1 FROM daily_facts
    WHERE user_id = ${userId} AND fact_date = ${date} AND source = 'reflection' LIMIT 1
  `;
  if (existing.length > 0) return;

  const text = raw.length > 1200 ? raw.slice(0, 1200) : raw;
  const out = await extractWithTool<{
    facts: { fact_type: string; life_area: string; value_text?: string; confidence: number }[];
  }>({
    model: HAIKU_MODEL,
    userText: `Daily reflection for ${date}:\n\n${text}`,
    tool: dailyFactsExtractionTool,
    maxTokens: 600,
  });

  for (const f of out.facts ?? []) {
    if (!f.fact_type || !f.life_area) continue;
    await insertFact({
      userId,
      date,
      factType: f.fact_type,
      source: "reflection",
      lifeArea: f.life_area,
      valueText: f.value_text ?? null,
      confidence: typeof f.confidence === "number" ? f.confidence : 1.0,
    });
  }
}

// -------------------------------------------------------------
// Stage entry point
// -------------------------------------------------------------

export async function advanceFacts(userId: number, tz: string): Promise<void> {
  const stage = "facts";
  const cursor = await getCursor(userId, stage);
  const ninetyAgo = daysAgoStr(tz, 90);
  const start = cursor ? maxDate(addDays(cursor, 1), ninetyAgo) : ninetyAgo;
  const end = daysAgoStr(tz, 1);
  if (start > end) return;

  // Restrict to dates that actually have source data.
  const candidateRows = await sql`
    SELECT to_char(day, 'YYYY-MM-DD') AS d FROM oura_daily
      WHERE user_id = ${userId} AND day >= ${start} AND day <= ${end}
    UNION
    SELECT to_char(entry_date, 'YYYY-MM-DD') AS d FROM reflections
      WHERE user_id = ${userId} AND entry_date >= ${start} AND entry_date <= ${end}
  `;
  const haveData = new Set((candidateRows as { d: string }[]).map((r) => r.d));

  let lastOk = cursor;
  for (const date of dateRange(start, end)) {
    if (!haveData.has(date)) {
      lastOk = date;
      continue;
    }
    try {
      await deterministicFacts(userId, date);
      await reflectionFacts(userId, date);
      lastOk = date;
    } catch (e) {
      await setError(userId, stage, `facts ${date}: ${String(e)}`);
      break;
    }
  }

  if (lastOk && lastOk !== cursor) {
    await setCursor(userId, stage, lastOk);
  }
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
