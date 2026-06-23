import { computeTrends, type TrendResult } from "@/lib/trends";
import { TREND_METRICS } from "@/app/components/trends/metricMeta";
import TrendsClient from "@/app/components/trends/TrendsClient";

// Per-user data backed by the DB — render per request, never prerender at build.
export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  let results: TrendResult[] = [];
  let failed = false;

  try {
    const all = await Promise.all(TREND_METRICS.map((m) => computeTrends(m.metric, "W")));
    // Only show metrics that actually have data points in the window.
    results = all.filter((r) => r.points.some((p) => p.value != null));
  } catch {
    failed = true;
  }

  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Trends</h1>
      </header>

      {results.length > 0 ? (
        <TrendsClient results={results} />
      ) : (
        <div className="mx-4 rounded-card glass-1 p-6 text-center animate-fade-in">
          <p className="text-[15px] font-semibold text-ink">
            {failed ? "Couldn’t load trends" : "No trend data yet"}
          </p>
          <p className="mt-1 text-[13px] text-ink-3">
            {failed
              ? "Make sure the database schema is applied, then sync Oura."
              : "Sync Oura to start seeing 7-day trends here."}
          </p>
        </div>
      )}
    </main>
  );
}
