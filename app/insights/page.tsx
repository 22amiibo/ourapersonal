import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

// Per-user data backed by the DB — render per request, never prerender at build.
export const dynamic = "force-dynamic";

type InsightRow = {
  claim: string;
  evidence_count: number;
  confidence: number;
  life_area: string;
  explanation: string | null;
  status: string;
};

async function getInsights(): Promise<InsightRow[]> {
  const rows = await sql`
    SELECT claim, evidence_count, confidence, life_area, explanation, status
    FROM insights
    WHERE user_id = ${USER_ID} AND status IN ('active', 'weakening')
    ORDER BY confidence DESC, evidence_count DESC
    LIMIT 20
  `;
  return rows as InsightRow[];
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function areaColor(area: string): string {
  switch (area) {
    case "sleep":    return "var(--color-accent-blue)";
    case "fitness":  return "var(--color-accent)";
    case "recovery": return "var(--color-accent)";
    case "focus":    return "var(--color-amber)";
    case "academic": return "var(--color-amber)";
    case "mood":     return "var(--color-rose)";
    default:         return "var(--color-ink-3)";
  }
}

export default async function InsightsPage() {
  const insights = await getInsights();

  return (
    <main className="mx-auto max-w-md pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)]">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="px-5 pb-4 animate-fade-in">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
          Intelligence
        </p>
        <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-ink">
          Insights
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-ink-3">
          Patterns discovered from your data
        </p>
      </header>

      {/* ── Feed ────────────────────────────────────────────── */}
      {insights.length === 0 ? (
        <div className="mx-4 rounded-card glass-1 p-6 text-center animate-spring-in">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "color-mix(in oklch, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-ink">Patterns are still forming</p>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-ink-3">
            The engine needs about a week of data to find what moves your sleep and recovery. Keep logging and reflecting daily.
          </p>
          <div className="mt-5 flex justify-center gap-2.5">
            <a href="/log" className="rounded-control bg-accent px-4 py-2.5 text-[13px] font-medium text-bg transition-all active:scale-[0.97] min-h-[44px] flex items-center">
              Log today
            </a>
            <a href="/reflect" className="rounded-control border border-line-strong px-4 py-2.5 text-[13px] font-medium text-ink transition-all active:scale-[0.97] min-h-[44px] flex items-center">
              Write a reflection
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {insights.map((ins, i) => {
            const color = areaColor(ins.life_area);
            const weakening = ins.status === "weakening";
            return (
              <article
                key={i}
                className="rounded-card glass-1 p-5 animate-spring-in"
                style={{
                  animationDelay: `${i * 40}ms`,
                  opacity: weakening ? 0.74 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Top row: area tag + weakening badge */}
                <div className="mb-2.5 flex items-center justify-between">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                    style={{
                      color,
                      background: `color-mix(in oklch, ${color} 14%, transparent)`,
                    }}
                  >
                    {ins.life_area}
                  </span>
                  {weakening && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                      weakening
                    </span>
                  )}
                </div>

                {/* Claim headline */}
                <h2 className="text-[15px] font-semibold leading-snug text-ink">
                  {ins.claim}
                </h2>

                {/* Chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
                    style={{
                      background: "var(--color-surface-2)",
                      color: "var(--color-ink-2)",
                    }}
                  >
                    {ins.evidence_count} evidence
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
                    style={{
                      background: `color-mix(in oklch, var(--color-accent) 12%, transparent)`,
                      color: "var(--color-accent)",
                    }}
                  >
                    {fmtPct(ins.confidence)} conf
                  </span>
                </div>

                {/* Explanation */}
                {ins.explanation && (
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
                    {ins.explanation}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
