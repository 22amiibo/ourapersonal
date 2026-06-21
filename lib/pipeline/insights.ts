import { sql } from "@/lib/db";
import { extractWithTool, MODEL } from "@/lib/anthropic";
import { insightGenerationTool, WEEKLY_INTELLIGENCE_SYSTEM } from "@/lib/prompts";
import { getCursor, setCursor } from "@/lib/pipeline/facts";

const MIN_EVIDENCE = 5;
const MIN_CONFIDENCE = 0.6;
const MIN_EFFECT_SIZE = 5.0;

const INSIGHT_SYSTEM =
  `${WEEKLY_INTELLIGENCE_SYSTEM} ` +
  `You are synthesizing confirmed statistical correlations into durable insight records. ` +
  `Only state claims supported by the supplied evidence. Be specific and reference numbers.`;

type CandidateRow = {
  id: number;
  feature_x: string;
  feature_y: string;
  lag_days: number;
  n: number;
  r: number;
  effect_size: number;
  life_area: string | null;
};

type InsightOutput = {
  insights: Array<{
    insight_key: string;
    category: string;
    life_area: string;
    claim: string;
    explanation?: string;
    evidence_summary: string;
  }>;
};

function rDerivedConfidence(r: number): number {
  return Math.min(1.0, (Math.abs(r) - 0.25) / 0.75);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function advanceInsights(userId: number): Promise<void> {
  const stage = "insights";
  const cursor = await getCursor(userId, stage);

  // Only run when there is at least one weekly summary newer than the cursor.
  const newWeekly = (await sql`
    SELECT COUNT(*)::int AS c
    FROM weekly_summaries
    WHERE user_id = ${userId}
      AND (${cursor}::date IS NULL OR week_of > ${cursor}::date)
  `) as Array<{ c: number }>;
  if ((newWeekly[0]?.c ?? 0) === 0) return;

  const candidates = (await sql`
    SELECT id, feature_x, feature_y, lag_days, n, r, effect_size, life_area
    FROM correlation_candidates
    WHERE user_id = ${userId}
      AND promoted = false
      AND ABS(r) >= 0.35
      AND ABS(effect_size) >= ${MIN_EFFECT_SIZE}
      AND computed_at >= NOW() - INTERVAL '90 days'
    ORDER BY ABS(r) DESC
    LIMIT 10
  `) as CandidateRow[];

  const qualifying: Array<CandidateRow & { confidence: number; evidence: number }> = [];
  for (const c of candidates) {
    const confidence = rDerivedConfidence(Number(c.r));
    if (confidence < MIN_CONFIDENCE) continue;

    const ev = (await sql`
      SELECT COUNT(*)::int AS c
      FROM daily_facts
      WHERE user_id = ${userId}
        AND life_area = ${c.life_area}
        AND fact_date >= NOW() - INTERVAL '90 days'
    `) as Array<{ c: number }>;
    const evidence = ev[0]?.c ?? 0;
    if (evidence < MIN_EVIDENCE) continue;

    qualifying.push({ ...c, confidence, evidence });
  }

  if (qualifying.length === 0) {
    await setCursor(userId, stage, today());
    return;
  }

  const contextRows = (await sql`
    SELECT summary_text
    FROM weekly_summaries
    WHERE user_id = ${userId}
    ORDER BY week_of DESC
    LIMIT 4
  `) as Array<{ summary_text: string }>;

  const out = await extractWithTool<InsightOutput>({
    model: MODEL,
    tool: insightGenerationTool,
    system: INSIGHT_SYSTEM,
    userText: JSON.stringify({
      candidates: qualifying.map((c) => ({
        feature_x: c.feature_x,
        feature_y: c.feature_y,
        lag_days: c.lag_days,
        r: Number(c.r),
        effect_size: Number(c.effect_size),
        n: c.n,
        life_area: c.life_area,
        evidence_count: c.evidence,
      })),
      context_summaries: contextRows.map((r) => r.summary_text),
    }),
    maxTokens: 1000,
  });

  const evidenceByArea = new Map<string, number>();
  for (const c of qualifying) {
    evidenceByArea.set(c.life_area ?? "", c.evidence);
  }
  const fallbackEvidence = qualifying[0]?.evidence ?? MIN_EVIDENCE;
  const fallbackConfidence = qualifying[0]?.confidence ?? MIN_CONFIDENCE;
  const td = today();

  for (const ins of out.insights ?? []) {
    const evCount = evidenceByArea.get(ins.life_area) ?? fallbackEvidence;
    await sql`
      INSERT INTO insights
        (user_id, insight_key, category, life_area, claim, explanation,
         evidence_summary, evidence_count, confidence, status,
         first_detected, last_confirmed, created_at, updated_at)
      VALUES
        (${userId}, ${ins.insight_key}, ${ins.category}, ${ins.life_area},
         ${ins.claim}, ${ins.explanation ?? null}, ${ins.evidence_summary},
         ${evCount}, ${fallbackConfidence}, 'active',
         ${td}, ${td}, NOW(), NOW())
      ON CONFLICT (user_id, insight_key) DO UPDATE
        SET claim = EXCLUDED.claim,
            explanation = EXCLUDED.explanation,
            evidence_summary = EXCLUDED.evidence_summary,
            confidence = EXCLUDED.confidence,
            evidence_count = insights.evidence_count + 1,
            last_confirmed = ${td},
            updated_at = NOW()
    `;
  }

  const ids = qualifying.map((c) => c.id);
  await sql`
    UPDATE correlation_candidates
    SET promoted = true, promoted_at = NOW()
    WHERE id = ANY(${ids})
  `;

  await setCursor(userId, stage, td);
}

// -------------------------------------------------------------
// Insight decay evaluation
// -------------------------------------------------------------

type InsightRow = {
  id: number;
  life_area: string;
  confidence: number;
  evidence_count: number;
  predictive_accuracy_factor: number;
  first_detected: string;
  last_confirmed: string | null;
};

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function recencyFactor(lastConfirmed: string | null, td: string): number {
  if (!lastConfirmed) return 0.2;
  const days = daysBetween(lastConfirmed, td);
  if (days < 30) return 1.0;
  if (days < 90) return 0.8;
  if (days < 180) return 0.6;
  return 0.2;
}

export async function evaluateInsightDecay(userId: number): Promise<void> {
  const td = today();
  const insights = (await sql`
    SELECT id, life_area, confidence, evidence_count, predictive_accuracy_factor,
           to_char(first_detected, 'YYYY-MM-DD') AS first_detected,
           to_char(last_confirmed, 'YYYY-MM-DD') AS last_confirmed
    FROM insights
    WHERE user_id = ${userId} AND status IN ('active', 'weakening')
  `) as InsightRow[];

  for (const ins of insights) {
    const recency = recencyFactor(ins.last_confirmed, td);

    const recentEv = (await sql`
      SELECT COUNT(*)::int AS c
      FROM daily_facts
      WHERE user_id = ${userId}
        AND life_area = ${ins.life_area}
        AND fact_date >= NOW() - INTERVAL '90 days'
    `) as Array<{ c: number }>;
    const recentCount = recentEv[0]?.c ?? 0;

    const daysSinceFirst = Math.max(1, daysBetween(ins.first_detected, td));
    const expectedRate = (Number(ins.evidence_count) / daysSinceFirst) * 90;
    const rawStability = expectedRate > 0 ? recentCount / expectedRate : 1.0;
    const evidenceStability = Math.max(0.1, Math.min(1.0, rawStability));

    const decay =
      Number(ins.confidence) *
      recency *
      evidenceStability *
      Number(ins.predictive_accuracy_factor);

    let status: string;
    if (decay > 0.6) status = "active";
    else if (decay >= 0.3) status = "weakening";
    else status = "archived";

    if (status === "archived") {
      await sql`
        INSERT INTO insight_conflicts
          (user_id, insight_id, conflict_type, description, detected_at)
        VALUES
          (${userId}, ${ins.id}, 'decaying_correlation',
           ${`Insight decayed below threshold (decay_score=${decay.toFixed(3)}).`}, NOW())
      `;
    }

    await sql`
      UPDATE insights
      SET decay_score = ${Number(decay.toFixed(4))},
          status = ${status},
          last_evaluated = ${td},
          updated_at = NOW()
      WHERE id = ${ins.id}
    `;
  }
}

// -------------------------------------------------------------
// Knowledge graph edge maintenance
// -------------------------------------------------------------

type EdgeRow = {
  id: number;
  subject: string;
  object: string;
  evidence_count: number;
  confidence: number;
};

export async function advanceGraphEdges(userId: number): Promise<void> {
  await sql`
    DELETE FROM knowledge_graph_edges
    WHERE user_id = ${userId} AND evidence_count < 3 AND confidence < 0.10
  `;

  const edges = (await sql`
    SELECT id, subject, object, evidence_count, confidence
    FROM knowledge_graph_edges
    WHERE user_id = ${userId}
  `) as EdgeRow[];

  for (const edge of edges) {
    const confirming = (await sql`
      SELECT COUNT(*)::int AS c
      FROM correlation_candidates
      WHERE user_id = ${userId}
        AND promoted = true
        AND computed_at >= NOW() - INTERVAL '30 days'
        AND (feature_x = ${edge.subject} OR feature_y = ${edge.object})
    `) as Array<{ c: number }>;
    if ((confirming[0]?.c ?? 0) === 0) continue;

    const newConfidence = Math.min(1.0, Number(edge.confidence) + 0.05);
    await sql`
      UPDATE knowledge_graph_edges
      SET evidence_count = evidence_count + 1,
          confidence = ${Number(newConfidence.toFixed(4))},
          last_updated = NOW()
      WHERE id = ${edge.id}
    `;
  }
}
