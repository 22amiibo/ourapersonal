import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import InsightsClient, { type InsightRow, type InsightsTab } from "./InsightsClient";
import { type AnomalyRow } from "./AnomalyList";

// Per-user data backed by the DB — render per request, never prerender at build.
export const dynamic = "force-dynamic";

async function getInsights(): Promise<InsightRow[]> {
  // The insights table is part of the intelligence layer and may not be
  // migrated in every environment — degrade to the empty state instead of 500.
  try {
    const rows = await sql`
      SELECT claim, evidence_count, confidence, life_area, explanation, status
      FROM insights
      WHERE user_id = ${USER_ID} AND status IN ('active', 'weakening')
      ORDER BY confidence DESC, evidence_count DESC
      LIMIT 20
    `;
    return rows as InsightRow[];
  } catch {
    return [];
  }
}

async function getAnomalies(): Promise<AnomalyRow[]> {
  try {
    const rows = await sql`
      SELECT id, to_char(event_date, 'YYYY-MM-DD') AS event_date, metric, life_area,
             severity, direction, z_score::float8, user_note
      FROM anomaly_events
      WHERE user_id = ${USER_ID}
        AND event_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY event_date DESC
      LIMIT 20
    `;
    return rows as AnomalyRow[];
  } catch {
    return [];
  }
}

export type PredictionAccuracy = { count: number; avgAccuracy: number } | null;

async function getPredictionAccuracy(): Promise<PredictionAccuracy> {
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n, AVG(accuracy)::float8 AS avg_acc
      FROM prediction_records
      WHERE user_id = ${USER_ID} AND evaluated_at IS NOT NULL AND accuracy IS NOT NULL
    `;
    const row = rows[0] as { n: number; avg_acc: number | null } | undefined;
    if (!row || row.n === 0 || row.avg_acc == null) return null;
    return { count: row.n, avgAccuracy: row.avg_acc };
  } catch {
    return null;
  }
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [insights, anomalies, accuracy, params] = await Promise.all([
    getInsights(),
    getAnomalies(),
    getPredictionAccuracy(),
    searchParams,
  ]);
  const initialTab: InsightsTab = params.tab === "patterns" ? "patterns" : "ask";

  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-4 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Insights</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          What your data is saying — and a place to ask it questions.
        </p>
      </header>

      <InsightsClient
        insights={insights}
        anomalies={anomalies}
        accuracy={accuracy}
        initialTab={initialTab}
      />
    </main>
  );
}
