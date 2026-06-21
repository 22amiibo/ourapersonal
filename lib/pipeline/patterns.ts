import { sql } from "@/lib/db";
import { extractWithTool, HAIKU_MODEL } from "@/lib/anthropic";
import { patternExplanationTool } from "@/lib/prompts";
import { getCursor, setCursor } from "@/lib/pipeline/facts";

// -------------------------------------------------------------
// Statistics (TypeScript — no SQL)
// -------------------------------------------------------------

function pearsonR(xs: number[], ys: number[]): number | null {
  if (xs.length < 10 || xs.length !== ys.length) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  if (dx < 1e-10 || dy < 1e-10) return null;
  return num / (dx * dy);
}

function stddev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(vals: number[]): number {
  return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Effect size: difference of group means of y, split on the median of x.
function groupEffectSize(xs: number[], ys: number[]): number {
  const med = median(xs);
  const highY: number[] = [];
  const lowY: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > med) highY.push(ys[i]);
    else lowY.push(ys[i]);
  }
  if (highY.length === 0 || lowY.length === 0) return 0;
  return mean(highY) - mean(lowY);
}

// -------------------------------------------------------------
// Feature pairs to test
// -------------------------------------------------------------

const FEATURE_PAIRS: Array<{ x: string; y: string; lag: number; lifeArea: string }> = [
  { x: "sleep_hours", y: "readiness", lag: 1, lifeArea: "recovery" },
  { x: "sleep_hours", y: "mood_score", lag: 1, lifeArea: "mood" },
  { x: "sleep_hours", y: "hrv", lag: 1, lifeArea: "recovery" },
  { x: "alcohol_drinks", y: "readiness", lag: 1, lifeArea: "recovery" },
  { x: "alcohol_drinks", y: "hrv", lag: 1, lifeArea: "recovery" },
  { x: "caffeine_mg", y: "readiness", lag: 1, lifeArea: "nutrition" },
  { x: "caffeine_mg", y: "sleep_hours", lag: 0, lifeArea: "nutrition" },
  { x: "workout_count", y: "mood_score", lag: 0, lifeArea: "fitness" },
  { x: "workout_count", y: "readiness", lag: 1, lifeArea: "fitness" },
  { x: "stress_score", y: "sleep_hours", lag: 0, lifeArea: "stress" },
  { x: "sleep_debt_7d", y: "readiness", lag: 0, lifeArea: "recovery" },
  { x: "confidence_score", y: "mood_score", lag: 0, lifeArea: "academics" },
  { x: "stress_score", y: "confidence_score", lag: 0, lifeArea: "stress" },
  { x: "stress_score", y: "confidence_score", lag: 1, lifeArea: "stress" },
  { x: "hrv", y: "readiness", lag: 0, lifeArea: "recovery" },
  { x: "sleep_hours", y: "energy_score", lag: 0, lifeArea: "sleep" },
  { x: "mood_score", y: "confidence_score", lag: 0, lifeArea: "mood" },
];

const FEATURE_COLUMNS = [
  "sleep_hours",
  "readiness",
  "hrv",
  "resting_hr",
  "caffeine_mg",
  "alcohol_drinks",
  "workout_count",
  "mood_score",
  "stress_score",
  "confidence_score",
  "energy_score",
  "sleep_debt_7d",
] as const;

type FeatureVectorRow = {
  vector_date: string;
} & Record<(typeof FEATURE_COLUMNS)[number], number | null>;

// Build lagged (x, y) sample pairs from chronologically-ordered rows.
function buildPairs(
  rows: FeatureVectorRow[],
  xKey: string,
  yKey: string,
  lag: number,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + lag < rows.length; i++) {
    const xv = rows[i][xKey as keyof FeatureVectorRow] as number | null;
    const yv = rows[i + lag][yKey as keyof FeatureVectorRow] as number | null;
    if (xv == null || yv == null) continue;
    xs.push(Number(xv));
    ys.push(Number(yv));
  }
  return { xs, ys };
}

// -------------------------------------------------------------
// Pattern discovery — Stage 1 (stats) + Stage 2 (Haiku)
// -------------------------------------------------------------

export async function advancePatterns(userId: number): Promise<void> {
  const rows = (await sql`
    SELECT to_char(vector_date, 'YYYY-MM-DD') AS vector_date,
           sleep_hours, readiness, hrv, resting_hr, caffeine_mg, alcohol_drinks,
           workout_count, mood_score, stress_score, confidence_score,
           energy_score, sleep_debt_7d
    FROM daily_feature_vectors
    WHERE user_id = ${userId}
    ORDER BY vector_date DESC
    LIMIT 90
  `) as FeatureVectorRow[];

  if (rows.length < 10) return;
  // Re-order to ascending so lag offsets read forward in time.
  rows.reverse();

  for (const pair of FEATURE_PAIRS) {
    const { xs, ys } = buildPairs(rows, pair.x, pair.y, pair.lag);
    if (xs.length < 10) continue;
    if (stddev(xs) < 0.5 || stddev(ys) < 0.5) continue;

    const r = pearsonR(xs, ys);
    if (r == null || Math.abs(r) < 0.25) continue;

    const effectSize = groupEffectSize(xs, ys);
    if (Math.abs(effectSize) < 2.0) continue;

    await sql`
      INSERT INTO correlation_candidates
        (user_id, feature_x, feature_y, lag_days, n, r, effect_size,
         window_days, life_area, computed_at)
      VALUES
        (${userId}, ${pair.x}, ${pair.y}, ${pair.lag}, ${xs.length},
         ${Number(r.toFixed(4))}, ${Number(effectSize.toFixed(4))},
         90, ${pair.lifeArea}, NOW())
    `;
  }

  const candidates = (await sql`
    SELECT id, feature_x, feature_y, lag_days, n, r, effect_size, life_area
    FROM correlation_candidates
    WHERE user_id = ${userId}
      AND promoted = false
      AND computed_at >= NOW() - INTERVAL '30 days'
      AND ABS(r) >= 0.35
    ORDER BY ABS(r) DESC
    LIMIT 10
  `) as CandidateRow[];

  if (candidates.length > 0) {
    await explainCandidates(userId, candidates);
  }
}

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

type ExplainOutput = {
  explanations: Array<{
    feature_x: string;
    feature_y: string;
    lag_days: number;
    description: string;
    graph_edge: {
      subject: string;
      relation: string;
      object: string;
      weight: number;
    };
  }>;
};

async function explainCandidates(userId: number, candidates: CandidateRow[]): Promise<void> {
  const input = candidates.map((c) => ({
    feature_x: c.feature_x,
    feature_y: c.feature_y,
    lag_days: c.lag_days,
    r: Number(c.r),
    effect_size: Number(c.effect_size),
    n: c.n,
  }));

  const out = await extractWithTool<ExplainOutput>({
    model: HAIKU_MODEL,
    tool: patternExplanationTool,
    userText: JSON.stringify(input),
    maxTokens: 800,
  });

  const lifeAreaByPair = new Map<string, string>();
  for (const c of candidates) {
    lifeAreaByPair.set(`${c.feature_x}|${c.feature_y}|${c.lag_days}`, c.life_area ?? "recovery");
  }

  for (const expl of out.explanations ?? []) {
    const edge = expl.graph_edge;
    if (!edge) continue;
    const lifeArea =
      lifeAreaByPair.get(`${expl.feature_x}|${expl.feature_y}|${expl.lag_days}`) ?? "recovery";
    const weight = Math.max(-1, Math.min(1, edge.weight));

    await sql`
      INSERT INTO knowledge_graph_edges
        (user_id, subject, relation, object, life_area, weight, confidence,
         evidence_count, last_updated)
      VALUES
        (${userId}, ${edge.subject}, ${edge.relation}, ${edge.object},
         ${lifeArea}, ${weight}, ${Math.abs(weight)}, 1, NOW())
      ON CONFLICT (user_id, subject, relation, object) DO UPDATE
        SET weight = EXCLUDED.weight,
            confidence = EXCLUDED.confidence,
            evidence_count = knowledge_graph_edges.evidence_count + 1,
            life_area = EXCLUDED.life_area,
            last_updated = NOW()
    `;
  }

  const ids = candidates.map((c) => c.id);
  await sql`
    UPDATE correlation_candidates
    SET promoted = true, promoted_at = NOW()
    WHERE id = ANY(${ids})
  `;
}

// -------------------------------------------------------------
// Anomaly detection
// -------------------------------------------------------------

const ANOMALY_METRICS: Array<{ metric: string; lifeArea: string }> = [
  { metric: "sleep_hours", lifeArea: "sleep" },
  { metric: "readiness", lifeArea: "recovery" },
  { metric: "hrv", lifeArea: "recovery" },
  { metric: "resting_hr", lifeArea: "recovery" },
  { metric: "mood_score", lifeArea: "mood" },
  { metric: "stress_score", lifeArea: "stress" },
];

export async function advanceAnomalies(userId: number): Promise<void> {
  const rows = (await sql`
    SELECT to_char(vector_date, 'YYYY-MM-DD') AS vector_date,
           sleep_hours, readiness, hrv, resting_hr, mood_score, stress_score
    FROM daily_feature_vectors
    WHERE user_id = ${userId}
    ORDER BY vector_date DESC
    LIMIT 35
  `) as FeatureVectorRow[];

  if (rows.length < 10) return;
  rows.reverse(); // ascending

  const detectionStart = Math.max(0, rows.length - 5);
  const baselineRows = rows.slice(0, detectionStart);
  const detectionRows = rows.slice(detectionStart);
  if (baselineRows.length < 5) return;

  for (const { metric, lifeArea } of ANOMALY_METRICS) {
    const baseVals = baselineRows
      .map((r) => r[metric as keyof FeatureVectorRow] as number | null)
      .filter((v): v is number => v != null)
      .map(Number);
    if (baseVals.length < 5) continue;

    const baseMean = mean(baseVals);
    const baseSd = stddev(baseVals);
    if (baseSd < 0.1) continue;

    for (const row of detectionRows) {
      const raw = row[metric as keyof FeatureVectorRow] as number | null;
      if (raw == null) continue;
      const observed = Number(raw);
      const diff = observed - baseMean;
      const z = diff / baseSd;
      if (Math.abs(diff) <= 1.5 * baseSd) continue;

      const absZ = Math.abs(z);
      const severity = absZ < 2.0 ? "mild" : absZ < 3.0 ? "moderate" : "severe";
      const direction = diff > 0 ? "high" : "low";

      const existing = (await sql`
        SELECT id FROM anomaly_events
        WHERE user_id = ${userId} AND event_date = ${row.vector_date} AND metric = ${metric}
        LIMIT 1
      `) as Array<{ id: number }>;
      if (existing.length > 0) continue;

      await sql`
        INSERT INTO anomaly_events
          (user_id, event_date, metric, life_area, baseline, observed, z_score,
           severity, direction, created_at)
        VALUES
          (${userId}, ${row.vector_date}, ${metric}, ${lifeArea},
           ${Number(baseMean.toFixed(3))}, ${Number(observed.toFixed(3))},
           ${Number(z.toFixed(3))}, ${severity}, ${direction}, NOW())
      `;
    }
  }
}
