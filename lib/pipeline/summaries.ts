import { sql } from "@/lib/db";
import { extractWithTool, MODEL, HAIKU_MODEL } from "@/lib/anthropic";
import {
  dailySummaryTool,
  weeklyIntelligenceReviewTool,
  monthlyNarrativeIntelligenceTool,
  DAILY_SUMMARY_SYSTEM,
  WEEKLY_INTELLIGENCE_SYSTEM,
  MONTHLY_INTELLIGENCE_SYSTEM,
} from "@/lib/prompts";
import {
  embedTexts,
  toVectorLiteral,
  buildDailySummaryText,
  buildWeeklySummaryText,
  buildMonthlySummaryText,
  buildReflectionText,
} from "@/lib/embeddings";
import { isMonday, localDateStr, daysAgoStr } from "@/lib/dates";
import { getCursor, setCursor, setError } from "@/lib/pipeline/facts";

function hasVoyage(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
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

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  dt.setUTCDate(dt.getUTCDate() - ((dow + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

function avg(nums: (number | null | undefined)[]): number | null {
  const vals = nums.filter((n): n is number => typeof n === "number");
  if (vals.length === 0) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

// -------------------------------------------------------------
// Daily summaries
// -------------------------------------------------------------

export async function advanceDailySummary(userId: number, tz: string): Promise<void> {
  const stage = "daily_summary";
  const cursor = await getCursor(userId, stage);
  const ninetyAgo = daysAgoStr(tz, 90);
  const start = cursor ? maxDate(addDays(cursor, 1), ninetyAgo) : ninetyAgo;
  const end = daysAgoStr(tz, 1);
  if (start > end) return;

  const ouraRows = await sql`
    SELECT to_char(day, 'YYYY-MM-DD') AS d FROM oura_daily
    WHERE user_id = ${userId} AND day >= ${start} AND day <= ${end}
  `;
  const haveOura = new Set((ouraRows as { d: string }[]).map((r) => r.d));

  let lastOk = cursor;
  for (const date of dateRange(start, end)) {
    if (!haveOura.has(date)) {
      lastOk = date;
      continue;
    }
    try {
      await buildDailySummary(userId, date);
      lastOk = date;
    } catch (e) {
      await setError(userId, stage, `daily_summary ${date}: ${String(e)}`);
      break;
    }
  }

  if (lastOk && lastOk !== cursor) await setCursor(userId, stage, lastOk);
}

async function buildDailySummary(userId: number, date: string): Promise<void> {
  const factRows = await sql`
    SELECT fact_type, source, life_area, value_num, value_text, confidence
    FROM daily_facts WHERE user_id = ${userId} AND fact_date = ${date}
    ORDER BY confidence DESC LIMIT 10
  `;
  const ouraRows = await sql`
    SELECT sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds
    FROM oura_daily WHERE user_id = ${userId} AND day = ${date}
  `;
  const fvRows = await sql`
    SELECT health_score, focus_score, recovery_score, academic_readiness,
           sleep_hours, readiness, mood_score, energy_score
    FROM daily_feature_vectors WHERE user_id = ${userId} AND vector_date = ${date}
  `;
  const oura = ouraRows[0] as Record<string, number | null> | undefined;
  const fv = fvRows[0] as Record<string, number | null> | undefined;

  const input = {
    date,
    facts: factRows,
    oura: oura ?? null,
    scores: fv
      ? {
          health: fv.health_score,
          focus: fv.focus_score,
          recovery: fv.recovery_score,
          energy: fv.energy_score,
        }
      : null,
  };

  const out = await extractWithTool<{
    summary_text: string;
    key_events: string[];
    top_insights?: string[];
    life_area: string;
  }>({
    model: HAIKU_MODEL,
    system: DAILY_SUMMARY_SYSTEM,
    userText: `Daily data for ${date}:\n\n${JSON.stringify(input)}`,
    tool: dailySummaryTool,
    maxTokens: 500,
  });

  const keyEvents = out.key_events ?? [];
  const topInsights = out.top_insights ?? [];

  await sql`
    INSERT INTO daily_summaries
      (user_id, summary_date, summary_text, key_events, top_insights, life_area, scores,
       health_score, focus_score, energy_score, recovery_score, model_ver)
    VALUES (${userId}, ${date}, ${out.summary_text}, ${keyEvents}, ${topInsights},
            ${out.life_area ?? null}, ${JSON.stringify(oura ?? {})},
            ${fv?.health_score ?? null}, ${fv?.focus_score ?? null},
            ${fv?.energy_score ?? null}, ${fv?.recovery_score ?? null}, ${HAIKU_MODEL})
    ON CONFLICT (user_id, summary_date) DO UPDATE
      SET summary_text = EXCLUDED.summary_text, key_events = EXCLUDED.key_events,
          top_insights = EXCLUDED.top_insights, life_area = EXCLUDED.life_area,
          scores = EXCLUDED.scores, health_score = EXCLUDED.health_score,
          focus_score = EXCLUDED.focus_score, energy_score = EXCLUDED.energy_score,
          recovery_score = EXCLUDED.recovery_score, model_ver = EXCLUDED.model_ver
  `;

  if (hasVoyage()) {
    try {
      const text = buildDailySummaryText({
        summary_text: out.summary_text,
        key_events: keyEvents,
        top_insights: topInsights,
      });
      const [emb] = await embedTexts([text]);
      if (emb) {
        await sql`
          UPDATE daily_summaries
          SET embedding = ${toVectorLiteral(emb)}::vector, embedding_model = 'voyage-3', embedded_at = NOW()
          WHERE user_id = ${userId} AND summary_date = ${date}
        `;
      }
    } catch {
      // embedding is best-effort; summary row already written
    }
  }
}

// -------------------------------------------------------------
// Weekly summaries (Monday only)
// -------------------------------------------------------------

export async function advanceWeeklySummary(userId: number, tz: string): Promise<void> {
  if (!isMonday(tz)) return;
  const stage = "weekly_summary";
  const cursor = await getCursor(userId, stage);

  // Candidate weeks: every Monday that has >=5 daily summaries and no weekly row.
  const weekRows = await sql`
    SELECT DISTINCT to_char(
      (summary_date - ((EXTRACT(ISODOW FROM summary_date)::int - 1) * INTERVAL '1 day'))::date,
      'YYYY-MM-DD') AS week_of
    FROM daily_summaries
    WHERE user_id = ${userId}
    ORDER BY week_of ASC
  `;
  const weeks = (weekRows as { week_of: string }[]).map((r) => r.week_of);

  let lastOk = cursor;
  for (const weekOf of weeks) {
    if (cursor && weekOf <= cursor) continue;
    const weekEnd = addDays(weekOf, 6);
    try {
      const ds = await sql`
        SELECT to_char(summary_date,'YYYY-MM-DD') AS d, summary_text, life_area,
               health_score, focus_score, energy_score, recovery_score, key_events
        FROM daily_summaries
        WHERE user_id = ${userId} AND summary_date >= ${weekOf} AND summary_date <= ${weekEnd}
        ORDER BY summary_date ASC
      `;
      const days = ds as Record<string, unknown>[];
      if (days.length < 5) continue;

      await buildWeeklySummary(userId, weekOf, days);
      lastOk = weekOf;
    } catch (e) {
      await setError(userId, stage, `weekly_summary ${weekOf}: ${String(e)}`);
      break;
    }
  }

  if (lastOk && lastOk !== cursor) await setCursor(userId, stage, lastOk);
}

async function buildWeeklySummary(
  userId: number,
  weekOf: string,
  days: Record<string, unknown>[]
): Promise<void> {
  const out = await extractWithTool<{
    summary_text: string;
    positive_patterns: string[];
    negative_patterns: string[];
    recommendations: string[];
    focus_trends?: string[];
    energy_trends?: string[];
    academic_trends?: string[];
  }>({
    model: MODEL,
    system: WEEKLY_INTELLIGENCE_SYSTEM,
    userText: `Week of ${weekOf}. Daily summaries:\n\n${JSON.stringify(days)}`,
    tool: weeklyIntelligenceReviewTool,
    maxTokens: 1500,
  });

  const scores = {
    health: avg(days.map((d) => d.health_score as number | null)),
    focus: avg(days.map((d) => d.focus_score as number | null)),
    energy: avg(days.map((d) => d.energy_score as number | null)),
    recovery: avg(days.map((d) => d.recovery_score as number | null)),
  };

  await sql`
    INSERT INTO weekly_summaries
      (user_id, week_of, summary_text, positive_patterns, negative_patterns, recommendations,
       focus_trends, energy_trends, academic_trends, scores, model_ver)
    VALUES (${userId}, ${weekOf}, ${out.summary_text}, ${out.positive_patterns ?? []},
            ${out.negative_patterns ?? []}, ${out.recommendations ?? []},
            ${out.focus_trends ?? []}, ${out.energy_trends ?? []}, ${out.academic_trends ?? []},
            ${JSON.stringify(scores)}, ${MODEL})
    ON CONFLICT (user_id, week_of) DO UPDATE
      SET summary_text = EXCLUDED.summary_text, positive_patterns = EXCLUDED.positive_patterns,
          negative_patterns = EXCLUDED.negative_patterns, recommendations = EXCLUDED.recommendations,
          focus_trends = EXCLUDED.focus_trends, energy_trends = EXCLUDED.energy_trends,
          academic_trends = EXCLUDED.academic_trends, scores = EXCLUDED.scores, model_ver = EXCLUDED.model_ver
  `;

  if (hasVoyage()) {
    try {
      const text = buildWeeklySummaryText({
        summary_text: out.summary_text,
        positive_patterns: out.positive_patterns,
        negative_patterns: out.negative_patterns,
      });
      const [emb] = await embedTexts([text]);
      if (emb) {
        await sql`
          UPDATE weekly_summaries
          SET embedding = ${toVectorLiteral(emb)}::vector, embedding_model = 'voyage-3', embedded_at = NOW()
          WHERE user_id = ${userId} AND week_of = ${weekOf}
        `;
      }
    } catch {
      // best-effort
    }
  }
}

// -------------------------------------------------------------
// Monthly summaries (1st of month only)
// -------------------------------------------------------------

export async function advanceMonthlySummary(userId: number, tz: string): Promise<void> {
  if (!localDateStr(tz).endsWith("-01")) return;
  const stage = "monthly_summary";
  const cursor = await getCursor(userId, stage);

  const monthRows = await sql`
    SELECT DISTINCT to_char(date_trunc('month', week_of), 'YYYY-MM-DD') AS month_of
    FROM weekly_summaries WHERE user_id = ${userId}
    ORDER BY month_of ASC
  `;
  const months = (monthRows as { month_of: string }[]).map((r) => r.month_of);

  let lastOk = cursor;
  for (const monthOf of months) {
    if (cursor && monthOf <= cursor) continue;
    try {
      const ws = await sql`
        SELECT to_char(week_of,'YYYY-MM-DD') AS week_of, summary_text,
               positive_patterns, negative_patterns, recommendations
        FROM weekly_summaries
        WHERE user_id = ${userId} AND date_trunc('month', week_of) = ${monthOf}::date
        ORDER BY week_of ASC LIMIT 5
      `;
      const weeks = ws as Record<string, unknown>[];
      if (weeks.length < 3) continue;

      await buildMonthlySummary(userId, monthOf, weeks);
      lastOk = monthOf;
    } catch (e) {
      await setError(userId, stage, `monthly_summary ${monthOf}: ${String(e)}`);
      break;
    }
  }

  if (lastOk && lastOk !== cursor) await setCursor(userId, stage, lastOk);
}

async function buildMonthlySummary(
  userId: number,
  monthOf: string,
  weeks: Record<string, unknown>[]
): Promise<void> {
  const out = await extractWithTool<{
    narrative: string;
    major_trends: string[];
    recurring_themes: string[];
    predictions?: string[];
  }>({
    model: MODEL,
    system: MONTHLY_INTELLIGENCE_SYSTEM,
    userText: `Month starting ${monthOf}. Weekly summaries:\n\n${JSON.stringify(weeks)}`,
    tool: monthlyNarrativeIntelligenceTool,
    maxTokens: 1800,
  });

  await sql`
    INSERT INTO monthly_summaries
      (user_id, month_of, narrative, major_trends, recurring_themes, predictions, scores, model_ver)
    VALUES (${userId}, ${monthOf}, ${out.narrative}, ${out.major_trends ?? []},
            ${out.recurring_themes ?? []}, ${out.predictions ?? []}, ${JSON.stringify({})}, ${MODEL})
    ON CONFLICT (user_id, month_of) DO UPDATE
      SET narrative = EXCLUDED.narrative, major_trends = EXCLUDED.major_trends,
          recurring_themes = EXCLUDED.recurring_themes, predictions = EXCLUDED.predictions,
          model_ver = EXCLUDED.model_ver
  `;

  if (hasVoyage()) {
    try {
      const text = buildMonthlySummaryText({ narrative: out.narrative, major_trends: out.major_trends });
      const [emb] = await embedTexts([text]);
      if (emb) {
        await sql`
          UPDATE monthly_summaries
          SET embedding = ${toVectorLiteral(emb)}::vector, embedding_model = 'voyage-3', embedded_at = NOW()
          WHERE user_id = ${userId} AND month_of = ${monthOf}
        `;
      }
    } catch {
      // best-effort
    }
  }
}

// -------------------------------------------------------------
// Embeddings backfill (reflections + un-embedded daily summaries)
// -------------------------------------------------------------

export async function advanceEmbeddings(userId: number): Promise<void> {
  if (!hasVoyage()) return;

  // Reflections without embeddings.
  const reflectionRows = await sql`
    SELECT r.id, r.raw_text
    FROM reflections r
    LEFT JOIN reflection_embeddings e ON e.reflection_id = r.id
    WHERE r.user_id = ${userId} AND e.reflection_id IS NULL
    ORDER BY r.id ASC LIMIT 20
  `;
  const reflections = reflectionRows as { id: number; raw_text: string | null }[];
  if (reflections.length > 0) {
    const texts = reflections.map((r) => buildReflectionText(r.raw_text ?? ""));
    const embs = await embedTexts(texts);
    for (let i = 0; i < reflections.length; i++) {
      const emb = embs[i];
      if (!emb) continue;
      await sql`
        INSERT INTO reflection_embeddings (reflection_id, embedding, embedding_model, embedded_at)
        VALUES (${reflections[i].id}, ${toVectorLiteral(emb)}::vector, 'voyage-3', NOW())
        ON CONFLICT (reflection_id) DO UPDATE
          SET embedding = EXCLUDED.embedding, embedding_model = EXCLUDED.embedding_model, embedded_at = NOW()
      `;
    }
  }

  // Daily summaries written before VOYAGE_API_KEY was available.
  const dsRows = await sql`
    SELECT id, summary_date, summary_text, key_events, top_insights
    FROM daily_summaries
    WHERE user_id = ${userId} AND embedded_at IS NULL
    ORDER BY summary_date ASC LIMIT 20
  `;
  const ds = dsRows as {
    id: number;
    summary_text: string;
    key_events: string[] | null;
    top_insights: string[] | null;
  }[];
  if (ds.length > 0) {
    const texts = ds.map((d) =>
      buildDailySummaryText({
        summary_text: d.summary_text,
        key_events: d.key_events,
        top_insights: d.top_insights,
      })
    );
    const embs = await embedTexts(texts);
    for (let i = 0; i < ds.length; i++) {
      const emb = embs[i];
      if (!emb) continue;
      await sql`
        UPDATE daily_summaries
        SET embedding = ${toVectorLiteral(emb)}::vector, embedding_model = 'voyage-3', embedded_at = NOW()
        WHERE id = ${ds[i].id}
      `;
    }
  }
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
