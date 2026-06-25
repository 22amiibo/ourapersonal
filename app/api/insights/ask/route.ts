import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { extractWithTool } from "@/lib/anthropic";
import { askDataTool, ASK_DATA_SYSTEM } from "@/lib/prompts";
import { computeTrends, type TrendMetric } from "@/lib/trends";

// "Ask your data": a single bounded Anthropic call answering a free-text
// question from a compact, pre-computed summary. Trends/averages are computed
// in SQL/JS (no raw rows to the model), keeping token cost flat per the build's
// zero-cost charting principle.

// Human-readable duration for sleep seconds (e.g. "7h 20m", "45m").
function fmtDuration(secs: number): string {
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.round((abs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const ASK_METRICS: { metric: TrendMetric; label: string }[] = [
  { metric: "readiness", label: "Readiness" },
  { metric: "sleep_score", label: "Sleep score" },
  { metric: "sleep_hours", label: "Sleep hours" },
  { metric: "hrv", label: "HRV" },
  { metric: "resting_hr", label: "Resting HR" },
];

export async function POST(req: Request) {
  let question = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ ok: false, error: "Question is empty" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ ok: false, error: "Question is too long" }, { status: 400 });
  }

  const lines: string[] = [`QUESTION: ${question}`, "", "DATA SUMMARY", ""];

  // Today's snapshot — the freshest Oura day, so "how am I doing today?" style
  // questions are grounded in current numbers, not just week-over-week trends.
  try {
    const snap = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, readiness_score, sleep_score,
             total_sleep_seconds, hrv_avg, resting_hr,
             (raw_payload->>'activity_score')::numeric AS activity_score
      FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 1`;
    const s = snap[0] as
      | { day: string; readiness_score: number | null; sleep_score: number | null;
          total_sleep_seconds: number | null; hrv_avg: number | null;
          resting_hr: number | null; activity_score: number | null }
      | undefined;
    if (s) {
      lines.push(`TODAY SNAPSHOT (most recent Oura day ${s.day}):`);
      const parts: string[] = [];
      if (s.readiness_score != null) parts.push(`Readiness ${Math.round(s.readiness_score)}`);
      if (s.sleep_score != null) parts.push(`Sleep ${Math.round(s.sleep_score)}`);
      if (s.activity_score != null) parts.push(`Activity ${Math.round(Number(s.activity_score))}`);
      if (parts.length) lines.push(`• ${parts.join(", ")}`);
      if (s.total_sleep_seconds != null) lines.push(`• Slept ${fmtDuration(s.total_sleep_seconds)}`);
      const vitals: string[] = [];
      if (s.hrv_avg != null) vitals.push(`HRV ${Math.round(s.hrv_avg)} ms`);
      if (s.resting_hr != null) vitals.push(`Resting HR ${Math.round(s.resting_hr)} bpm`);
      if (vitals.length) lines.push(`• ${vitals.join(", ")}`);
      lines.push("");
    }
  } catch {
    // no Oura data — skip the snapshot.
  }

  // Sleep debt over the last 7 nights vs an 8h/night target (matches dashboard).
  try {
    const dr = await sql`
      SELECT COALESCE(SUM(total_sleep_seconds), 0)::bigint AS total, COUNT(*) AS nights
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND day >= (CURRENT_DATE - INTERVAL '7 days')
        AND total_sleep_seconds IS NOT NULL`;
    const row = dr[0] as { total: number; nights: number } | undefined;
    const nights = Number(row?.nights ?? 0);
    if (nights >= 3) {
      const debt = 7 * 8 * 3600 - Number(row?.total ?? 0);
      const word = debt > 0 ? `${fmtDuration(debt)} of sleep debt` : `${fmtDuration(debt)} ahead`;
      lines.push(`SLEEP (last 7 nights): ${word} vs 8h/night (${nights} nights logged)`, "");
    }
  } catch {
    // skip
  }

  // Recent mood — average + the latest entry's tags, when mood logging is live.
  try {
    const [avgRows, lastRows] = await Promise.all([
      sql`SELECT ROUND(AVG(mood), 1) AS avg, COUNT(*) AS n FROM mood_logs
          WHERE user_id = ${USER_ID} AND log_date >= (CURRENT_DATE - INTERVAL '14 days')`,
      sql`SELECT mood, tags, to_char(log_date, 'YYYY-MM-DD') AS d FROM mood_logs
          WHERE user_id = ${USER_ID} ORDER BY log_date DESC, logged_at DESC LIMIT 1`,
    ]);
    const a = avgRows[0] as { avg: number | null; n: number } | undefined;
    const last = lastRows[0] as { mood: number; tags: string[] | null; d: string } | undefined;
    if (a && Number(a.n) > 0) {
      const tagStr = last?.tags && last.tags.length ? ` [${last.tags.join(", ")}]` : "";
      const lastStr = last ? `; latest ${last.mood}${tagStr} on ${last.d}` : "";
      lines.push(`MOOD (last 14 days): avg ${a.avg}/10 over ${a.n} logs${lastStr}`, "");
    }
  } catch {
    // mood_logs not present — skip.
  }

  // 7-day trend snapshot per key metric (pure SQL/JS).
  lines.push("RECENT TRENDS (last 7 days vs prior 7):");
  let anyTrend = false;
  await Promise.all(
    ASK_METRICS.map(async ({ metric, label }) => {
      try {
        const t = await computeTrends(metric, "W", USER_ID);
        if (!Number.isFinite(t.average)) return;
        anyTrend = true;
        const deltaStr = t.direction === "flat" ? "no change" : `${t.delta > 0 ? "+" : ""}${t.delta.toFixed(1)}`;
        return `• ${label}: avg ${t.average.toFixed(1)}${t.unit ? " " + t.unit : ""} (${deltaStr} vs prior, ${t.direction})`;
      } catch {
        return undefined;
      }
    }),
  ).then((rows) => rows.filter(Boolean).forEach((r) => lines.push(r as string)));
  if (!anyTrend) lines.push("(no trend data available)");

  // Recent daily summaries (already terse, model-written).
  lines.push("", "RECENT DAILY SUMMARIES:");
  try {
    const sums = await sql`
      SELECT to_char(summary_date, 'YYYY-MM-DD') AS d, summary_text, life_area
      FROM daily_summaries WHERE user_id = ${USER_ID}
      ORDER BY summary_date DESC LIMIT 7`;
    if (sums.length > 0) {
      for (const s of sums as { d: string; summary_text: string; life_area: string | null }[]) {
        lines.push(`${s.d} [${s.life_area ?? "—"}]: ${s.summary_text}`);
      }
    } else {
      lines.push("(none yet)");
    }
  } catch {
    lines.push("(none yet)");
  }

  // Active insights (claim + explanation).
  lines.push("", "ACTIVE INSIGHTS:");
  try {
    const ins = await sql`
      SELECT claim, explanation FROM insights
      WHERE user_id = ${USER_ID} AND status IN ('active', 'weakening')
      ORDER BY confidence DESC, evidence_count DESC LIMIT 12`;
    if (ins.length > 0) {
      for (const i of ins as { claim: string; explanation: string | null }[]) {
        lines.push(`• ${i.claim}${i.explanation ? ` — ${i.explanation}` : ""}`);
      }
    } else {
      lines.push("(none yet)");
    }
  } catch {
    lines.push("(none yet)");
  }

  try {
    const out = await extractWithTool<{ answer: string; grounded: boolean }>({
      system: ASK_DATA_SYSTEM,
      userText: lines.join("\n"),
      tool: askDataTool,
      maxTokens: 500,
    });
    return NextResponse.json({ ok: true, answer: out.answer, grounded: out.grounded });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
