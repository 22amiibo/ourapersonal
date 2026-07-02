import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import InsightsClient, { type InsightRow, type InsightsTab } from "./InsightsClient";

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

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [insights, params] = await Promise.all([getInsights(), searchParams]);
  const initialTab: InsightsTab = params.tab === "patterns" ? "patterns" : "ask";

  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-4 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Insights</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          What your data is saying — and a place to ask it questions.
        </p>
      </header>

      <InsightsClient insights={insights} initialTab={initialTab} />
    </main>
  );
}
