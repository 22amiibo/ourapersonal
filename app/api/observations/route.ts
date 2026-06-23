import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { localDateStr, daysAgoStr } from "@/lib/dates";
import { extractWithTool, MODEL } from "@/lib/anthropic";
import { observationTool, OBSERVATION_SYSTEM } from "@/lib/prompts";
import { computeTrends, type TrendMetric } from "@/lib/trends";

const SUMMARY_METRICS: TrendMetric[] = ["readiness", "sleep_score", "hrv", "resting_hr"];

async function userTz(): Promise<string> {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

// GET /api/observations — latest observations (newest first).
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, to_char(range_start, 'YYYY-MM-DD') AS range_start,
             to_char(range_end, 'YYYY-MM-DD') AS range_end, body, model, created_at
      FROM observations
      WHERE user_id = ${USER_ID}
      ORDER BY created_at DESC
      LIMIT 30
    `;
    return NextResponse.json({ observations: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/observations — generate one observation from a FIXED-SIZE summary
// (pre-computed trend deltas + latest daily summary + recent reflections).
// The model never sees raw daily rows, so token cost stays bounded.
export async function POST() {
  try {
    const tz = await userTz();
    const today = localDateStr(tz);
    const weekAgo = daysAgoStr(tz, 7);

    // 1) Pre-computed trend deltas (SQL/JS, no AI).
    const trends = await Promise.all(SUMMARY_METRICS.map((m) => computeTrends(m, "W")));
    const trendLines = trends
      .filter((t) => t.points.some((p) => p.value != null))
      .map((t) => {
        const arrow = t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→";
        const unit = t.unit ? ` ${t.unit}` : "";
        return `- ${t.metric}: avg ${t.average}${unit} (${arrow} ${t.delta >= 0 ? "+" : ""}${t.delta} vs prior week; ${t.daysAbove}/${t.points.length} days above baseline)`;
      });

    // 2) Latest daily summary (best-effort — table may be empty).
    let dailySummary = "";
    try {
      const ds = (await sql`
        SELECT summary_text FROM daily_summaries
        WHERE user_id = ${USER_ID} ORDER BY summary_date DESC LIMIT 1
      `) as { summary_text: string }[];
      dailySummary = ds[0]?.summary_text ?? "";
    } catch {
      /* table may not exist yet */
    }

    // 3) Recent reflections (truncated).
    const reflections = (await sql`
      SELECT to_char(entry_date, 'YYYY-MM-DD') AS d, raw_text
      FROM reflections WHERE user_id = ${USER_ID}
      ORDER BY entry_date DESC LIMIT 3
    `) as { d: string; raw_text: string }[];
    const reflLines = reflections.map((r) => `- ${r.d}: ${r.raw_text.slice(0, 300)}`);

    const summary = [
      `Date range: ${weekAgo} to ${today}.`,
      "",
      "7-day trends vs prior week:",
      trendLines.length ? trendLines.join("\n") : "- (no trend data available)",
      "",
      dailySummary ? `Latest daily summary: ${dailySummary}` : "",
      "",
      reflLines.length ? `Recent reflections:\n${reflLines.join("\n")}` : "No recent reflections.",
    ]
      .filter(Boolean)
      .join("\n");

    const out = await extractWithTool<{ body: string }>({
      system: OBSERVATION_SYSTEM,
      userText: summary,
      tool: observationTool,
      maxTokens: 400,
    });

    const body = (out.body ?? "").trim();
    if (!body) {
      return NextResponse.json({ error: "Empty observation" }, { status: 502 });
    }

    const inserted = (await sql`
      INSERT INTO observations (user_id, range_start, range_end, body, model)
      VALUES (${USER_ID}, ${weekAgo}, ${today}, ${body}, ${MODEL})
      RETURNING id, to_char(range_start,'YYYY-MM-DD') AS range_start,
                to_char(range_end,'YYYY-MM-DD') AS range_end, body, model, created_at
    `) as Record<string, unknown>[];

    return NextResponse.json({ observation: inserted[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
