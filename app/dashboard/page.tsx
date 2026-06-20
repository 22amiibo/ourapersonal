import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { localDateStr, daysAgoStr, getGreeting } from "@/lib/dates";
import ChartContainer from "@/app/components/ui/ChartContainer";
import Ring from "@/app/components/ui/Ring";
import RunButton from "./RunButton";
import Metrics from "./Metrics";

async function getTz() {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

export default async function DashboardPage() {
  const tz = await getTz();
  const today = localDateStr(tz);
  const weekAgo = daysAgoStr(tz, 7);

  const briefingRows = await sql`
    SELECT summary_text, recommendations, context_window FROM briefings
    WHERE user_id = ${USER_ID} ORDER BY briefing_date DESC LIMIT 1`;
  const briefingRow = briefingRows[0] as {
    summary_text: string;
    recommendations: string[];
    context_window: Record<string, unknown>;
  } | undefined;

  const headline = briefingRow?.context_window?.headline as string | undefined;
  const briefing = briefingRow;

  const reflections = await sql`
    SELECT r.entry_date, r.raw_text, m.confidence_level
    FROM reflections r LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
    WHERE r.user_id = ${USER_ID} AND r.entry_date >= ${weekAgo} ORDER BY r.entry_date DESC`;

  const ouraRows = await sql`
    SELECT sleep_score, readiness_score, total_sleep_seconds
    FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 1`;
  const oura = ouraRows[0] as
    | { sleep_score: number | null; readiness_score: number | null; total_sleep_seconds: number | null }
    | undefined;

  const events = await sql`
    SELECT title, kind, starts_at FROM calendar_events
    WHERE user_id = ${USER_ID} AND starts_at >= ${today} ORDER BY starts_at ASC LIMIT 6`;

  const sleepH = oura?.total_sleep_seconds ? `${(oura.total_sleep_seconds / 3600).toFixed(1)}h` : "—";

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{getGreeting(tz)}</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </header>

      {/* Headline briefing card */}
      {headline && (
        <section className="rounded-card border border-accent/30 bg-accent/5 p-4 shadow-card">
          <p className="text-sm font-medium leading-snug text-ink">{headline}</p>
        </section>
      )}

      {/* Glance: last night */}
      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">Last night</p>
        {oura ? (
          <div className="flex justify-around">
            <div className="flex flex-col items-center gap-1.5">
              <Ring score={oura.sleep_score} size={84} />
              <div className="text-center">
                <p className="text-sm font-medium text-ink">Sleep</p>
                <p className="text-xs text-ink-3">{sleepH}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Ring score={oura.readiness_score} size={84} />
              <div className="text-center">
                <p className="text-sm font-medium text-ink">Readiness</p>
                <p className="text-xs text-ink-3">Recovery</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-3">Connect Oura in Settings to see last night.</p>
        )}
      </section>

      {/* Briefing detail */}
      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-ink-3">Briefing</p>
        {briefing ? (
          <>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{briefing.summary_text}</p>
            {Array.isArray(briefing.recommendations) && briefing.recommendations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {briefing.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-2">No briefing yet. Add a reflection, then generate one.</p>
        )}
        <div className="mt-4 border-t border-line pt-3.5">
          <RunButton />
        </div>
      </section>

      <Metrics />

      <ChartContainer title="Upcoming">
        {events.length ? (
          <ul className="divide-y divide-line">
            {events.map((e, i) => {
              const ev = e as { title: string; kind: string; starts_at: string };
              return (
                <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs lowercase text-ink-3">{ev.kind}</span>
                  <span className="flex-1 text-sm text-ink">{ev.title}</span>
                  <span className="font-mono text-xs tabular-nums text-ink-3">{new Date(ev.starts_at).toLocaleDateString()}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">Nothing scheduled. Add a calendar in Settings.</p>
        )}
      </ChartContainer>

      <ChartContainer title="Recent reflections">
        {reflections.length ? (
          <ul className="space-y-3">
            {reflections.map((r, i) => {
              const rf = r as { entry_date: string; raw_text: string; confidence_level: number | null };
              return (
                <li key={i} className="rounded-control border border-line bg-bg/40 p-3.5">
                  <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] tabular-nums text-ink-3">
                    <span>{rf.entry_date}</span>
                    {rf.confidence_level != null && <><span aria-hidden>·</span><span>confidence {rf.confidence_level}/10</span></>}
                  </div>
                  <p className="text-sm leading-relaxed text-ink-2">{rf.raw_text}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No reflections yet. Write your first in Reflect.</p>
        )}
      </ChartContainer>
    </main>
  );
}
