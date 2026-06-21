import { sql } from "@/lib/db";
import { toVectorLiteral } from "@/lib/embeddings";

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------

export type RetrievalBudget = {
  daily_summaries?: number;
  weekly_summaries?: number;
  monthly_summaries?: number;
  reflections?: number;
  insights?: number;
  graph_edges?: number;
  predictions?: number;
  calendar_events?: number;
};

export type RetrievedRecord = {
  source_type: string;
  source_id: number;
  source_date: string;
  content: string;
  score: number;
  life_area?: string;
};

export type QueryIntent = {
  intent: string;
  lifeAreaBoost: string[];
  lifeAreaReduce: string[];
};

// -------------------------------------------------------------
// Retrieval budgets (spec Section 5.2)
// -------------------------------------------------------------

export const RETRIEVAL_BUDGETS: Record<string, RetrievalBudget> = {
  morning_briefing: { daily_summaries: 7, insights: 5, calendar_events: 5, predictions: 3 },
  user_question: {
    daily_summaries: 5,
    weekly_summaries: 3,
    monthly_summaries: 2,
    reflections: 5,
    insights: 5,
    graph_edges: 10,
  },
  weekly_review: { daily_summaries: 7, weekly_summaries: 4, insights: 10, graph_edges: 10 },
};

// -------------------------------------------------------------
// Intent detection (spec Section 5.4) — no LLM
// -------------------------------------------------------------

const INTENT_SIGNALS: Record<string, string[]> = {
  explanation: ["why", "what caused", "reason", "because"],
  prediction: ["will", "likely", "expect", "tomorrow", "next week"],
  academic: ["exam", "biology", "grade", "score", "study", "confidence"],
  health: ["sleep", "readiness", "hrv", "recovery", "heart rate"],
  stress: ["stress", "anxious", "overwhelmed", "pressure"],
  recommendation: ["should", "improve", "better", "optimize", "how to"],
  trend: ["trend", "over time", "lately", "recently", "this month"],
};

export function detectIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  let bestIntent = "general";
  let bestScore = 0;
  for (const [intent, signals] of Object.entries(INTENT_SIGNALS)) {
    const score = signals.filter((s) => q.includes(s)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }
  const boostMap: Record<string, string[]> = {
    academic: ["academics"],
    health: ["sleep", "recovery"],
    stress: ["stress", "mood"],
    prediction: [],
    recommendation: [],
    trend: [],
    explanation: [],
    general: [],
  };
  return { intent: bestIntent, lifeAreaBoost: boostMap[bestIntent] ?? [], lifeAreaReduce: [] };
}

// -------------------------------------------------------------
// Ranking helpers (spec Section 5.3)
// -------------------------------------------------------------

function recencyWeight(dateStr: string): number {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 30) return 1.0;
  if (days <= 90) return 0.8;
  if (days <= 365) return 0.6;
  return 0.4;
}

function qualityWeight(retrievalCount: number, successCount: number): number {
  if (!retrievalCount || retrievalCount <= 0) return 1.0;
  return successCount / retrievalCount;
}

function lifeAreaMultiplier(lifeArea: string | undefined, intent?: QueryIntent): number {
  if (!intent || !lifeArea) return 1.0;
  if (intent.lifeAreaBoost.includes(lifeArea)) return 1.25;
  if (intent.lifeAreaReduce.includes(lifeArea)) return 0.75;
  return 1.0;
}

// -------------------------------------------------------------
// Per-layer retrieval configuration
// -------------------------------------------------------------

type LayerConfig = {
  table: string;
  sourceType: string;
  recordType: string;
  dateCol: string;
  textCol: string;
  hasLifeArea: boolean;
};

const LAYER_CONFIG: Record<keyof RetrievalBudget, LayerConfig | null> = {
  daily_summaries: {
    table: "daily_summaries",
    sourceType: "daily_summary",
    recordType: "daily_summary",
    dateCol: "summary_date",
    textCol: "summary_text",
    hasLifeArea: true,
  },
  weekly_summaries: {
    table: "weekly_summaries",
    sourceType: "weekly_summary",
    recordType: "weekly_summary",
    dateCol: "week_of",
    textCol: "summary_text",
    hasLifeArea: true,
  },
  monthly_summaries: {
    table: "monthly_summaries",
    sourceType: "monthly_summary",
    recordType: "monthly_summary",
    dateCol: "month_of",
    textCol: "narrative",
    hasLifeArea: true,
  },
  reflections: null, // reflections embed via reflection_embeddings — handled separately
  insights: {
    table: "insights",
    sourceType: "insight",
    recordType: "insight",
    dateCol: "first_detected",
    textCol: "claim",
    hasLifeArea: true,
  },
  graph_edges: null, // entity match, not semantic
  predictions: null, // chronological, not semantic
  calendar_events: null, // chronological, not semantic
};

// -------------------------------------------------------------
// Semantic retrieval
// -------------------------------------------------------------

export async function semanticRetrieve(
  userId: number,
  queryEmbedding: number[],
  budget: RetrievalBudget,
  intent?: QueryIntent,
): Promise<RetrievedRecord[]> {
  const vecLiteral = toVectorLiteral(queryEmbedding);
  const out: RetrievedRecord[] = [];

  for (const [layer, n] of Object.entries(budget)) {
    if (!n || n <= 0) continue;
    const cfg = LAYER_CONFIG[layer as keyof RetrievalBudget];
    if (!cfg) continue;

    let rows: SemanticRow[] = [];
    try {
      rows = await querySemanticLayer(userId, cfg, vecLiteral, n);
    } catch {
      continue; // fall back happens at caller layer via fullTextRetrieve
    }

    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      await bumpRetrievalCount(cfg.table, ids);
    }

    for (const r of rows) {
      const recency = recencyWeight(r.source_date);
      const quality = qualityWeight(
        Number(r.retrieval_count ?? 0),
        Number(r.successful_retrieval_count ?? 0),
      );
      const laMult = lifeAreaMultiplier(r.life_area ?? undefined, intent);
      const final = Number(r.similarity) * recency * quality * laMult;
      out.push({
        source_type: cfg.sourceType,
        source_id: r.id,
        source_date: r.source_date,
        content: r.content,
        score: final,
        life_area: r.life_area ?? undefined,
      });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return dedupeMMR(out);
}

type SemanticRow = {
  id: number;
  source_date: string;
  content: string;
  similarity: number;
  life_area: string | null;
  retrieval_count: number | null;
  successful_retrieval_count: number | null;
};

async function querySemanticLayer(
  userId: number,
  cfg: LayerConfig,
  vecLiteral: string,
  n: number,
): Promise<SemanticRow[]> {
  const lifeAreaSelect = cfg.hasLifeArea ? "life_area" : "NULL::text AS life_area";
  const query = `
    SELECT id,
           to_char(${cfg.dateCol}, 'YYYY-MM-DD') AS source_date,
           ${cfg.textCol} AS content,
           1 - (embedding <=> $1::vector) AS similarity,
           ${lifeAreaSelect},
           retrieval_count,
           successful_retrieval_count
    FROM ${cfg.table}
    WHERE user_id = $2 AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `;
  return (await sql.query(query, [vecLiteral, userId, n])) as SemanticRow[];
}

async function bumpRetrievalCount(table: string, ids: number[]): Promise<void> {
  const query = `
    UPDATE ${table}
    SET retrieval_count = retrieval_count + 1, last_retrieved = NOW()
    WHERE id = ANY($1)
  `;
  await sql.query(query, [ids]);
}

// -------------------------------------------------------------
// Diversity filter (spec Section 5.5) — Jaccard on word sets
// -------------------------------------------------------------

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function dedupeMMR(records: RetrievedRecord[]): RetrievedRecord[] {
  const kept: RetrievedRecord[] = [];
  const keptSets: Set<string>[] = [];
  for (const rec of records) {
    const set = wordSet(rec.content);
    const dup = keptSets.some((s) => jaccard(set, s) > 0.8);
    if (dup) continue;
    kept.push(rec);
    keptSets.push(set);
  }
  return kept;
}

// -------------------------------------------------------------
// Full-text fallback (spec Section 5.7)
// -------------------------------------------------------------

export async function fullTextRetrieve(
  userId: number,
  query: string,
  budget: RetrievalBudget,
): Promise<RetrievedRecord[]> {
  const out: RetrievedRecord[] = [];

  for (const [layer, n] of Object.entries(budget)) {
    if (!n || n <= 0) continue;
    const cfg = LAYER_CONFIG[layer as keyof RetrievalBudget];
    if (!cfg) continue;

    const lifeAreaSelect = cfg.hasLifeArea ? "life_area" : "NULL::text AS life_area";
    const sqlText = `
      SELECT id,
             to_char(${cfg.dateCol}, 'YYYY-MM-DD') AS source_date,
             ${cfg.textCol} AS content,
             ${lifeAreaSelect},
             ts_rank(to_tsvector('english', ${cfg.textCol}),
                     plainto_tsquery('english', $1)) AS score
      FROM ${cfg.table}
      WHERE user_id = $2
        AND to_tsvector('english', ${cfg.textCol}) @@ plainto_tsquery('english', $1)
      ORDER BY score DESC
      LIMIT $3
    `;
    let rows: Array<{
      id: number;
      source_date: string;
      content: string;
      life_area: string | null;
      score: number;
    }> = [];
    try {
      rows = (await sql.query(sqlText, [query, userId, n])) as typeof rows;
    } catch {
      continue;
    }
    for (const r of rows) {
      out.push({
        source_type: cfg.sourceType,
        source_id: r.id,
        source_date: r.source_date,
        content: r.content,
        score: Number(r.score),
        life_area: r.life_area ?? undefined,
      });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return dedupeMMR(out);
}

// -------------------------------------------------------------
// Retrieval logging
// -------------------------------------------------------------

export async function logRetrieval(
  userId: number,
  records: RetrievedRecord[],
  reason: string,
  queryHash?: string,
): Promise<void> {
  for (const r of records) {
    await sql`
      INSERT INTO memory_access_logs
        (user_id, record_type, record_id, retrieval_score, retrieval_method,
         retrieval_reason, query_hash, accessed_at)
      VALUES
        (${userId}, ${r.source_type}, ${r.source_id}, ${Number(r.score.toFixed(4))},
         'semantic', ${reason}, ${queryHash ?? null}, NOW())
    `;
  }
}

const SOURCE_TYPE_TO_TABLE: Record<string, string> = {
  daily_summary: "daily_summaries",
  weekly_summary: "weekly_summaries",
  monthly_summary: "monthly_summaries",
  insight: "insights",
};

export async function markRetrievalSuccess(
  recordType: string,
  recordIds: number[],
): Promise<void> {
  if (recordIds.length === 0) return;
  const table = SOURCE_TYPE_TO_TABLE[recordType];
  if (!table) return;
  const query = `
    UPDATE ${table}
    SET successful_retrieval_count = successful_retrieval_count + 1,
        last_retrieved = NOW()
    WHERE id = ANY($1)
  `;
  await sql.query(query, [recordIds]);
}
