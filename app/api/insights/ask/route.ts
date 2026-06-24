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
      maxTokens: 400,
    });
    return NextResponse.json({ ok: true, answer: out.answer, grounded: out.grounded });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
