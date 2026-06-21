import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { localDateStr, daysAgoStr, getGreeting } from "@/lib/dates";
import Ring from "@/app/components/ui/Ring";
import Sparkline from "@/app/components/ui/Sparkline";
import RunButton from "./RunButton";
import Metrics from "./Metrics";
import OuraDetails from "./OuraDetails";
import HabitCheckins from "./HabitCheckins";

async function getTz() {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

function stateLabel(readiness: number | null): string {
  if (readiness == null) return "Connect Oura to see your readiness.";
  if (readiness >= 85) return "Outstanding readiness.";
  if (readiness >= 70) return "Good day to perform.";
  if (readiness >= 55) return "Moderate recovery — pace yourself.";
  return "Low readiness — prioritize rest.";
}

function formatEventDate(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function wellnessGrade(s: number): string {
  if (s >= 90) return "A+";
  if (s >= 85) return "A";
  if (s >= 80) return "A−";
  if (s >= 75) return "B+";
  if (s >= 70) return "B";
  if (s >= 65) return "B−";
  if (s >= 55) return "C";
  return "D";
}

function fmtDuration(secs: number): string {
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.round((abs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function DashboardPage() {
  const tz = await getTz();
  const today = localDateStr(tz);
  const weekAgo = daysAgoStr(tz, 7);

  const [briefingRows, ouraRows, trendRows, events, sleepDebtRows] = await Promise.all([
    sql`
      SELECT summary_text, recommendations, context_window FROM briefings
      WHERE user_id = ${USER_ID} ORDER BY briefing_date DESC LIMIT 1`,
    sql`
      SELECT sleep_score, readiness_score, total_sleep_seconds,
             (raw_payload->>'activity_score')::numeric AS activity_score
      FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 1`,
    sql`
      SELECT readiness_score, sleep_score,
             (raw_payload->>'activity_score')::numeric AS activity_score
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND day >= ${weekAgo}
      ORDER BY day ASC`,
    sql`
      SELECT title, kind, starts_at FROM calendar_events
      WHERE user_id = ${USER_ID} AND starts_at >= ${today} ORDER BY starts_at ASC LIMIT 3`,
    sql`
      SELECT COALESCE(SUM(total_sleep_seconds), 0)::bigint AS total_sleep,
             COUNT(*) AS nights
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND day >= ${weekAgo} AND total_sleep_seconds IS NOT NULL`,
  ]);

  const briefingRow = briefingRows[0] as {
    summary_text: string;
    recommendations: string[];
    context_window: Record<string, unknown>;
  } | undefined;
  const headline = briefingRow?.context_window?.headline as string | undefined;
  const briefing = briefingRow;

  const oura = ouraRows[0] as
    | { sleep_score: number | null; readiness_score: number | null; activity_score: number | null; total_sleep_seconds: number | null }
    | undefined;

  type TrendRow = { readiness_score: number | null; sleep_score: number | null; activity_score: number | null };
  const trend = trendRows as TrendRow[];
  const readinessTrend = trend.map((r) => r.readiness_score ?? 0);
  const sleepTrend = trend.map((r) => r.sleep_score ?? 0);
  const activityTrend = trend.map((r) => r.activity_score ?? 0);

  const sleepDebtRow = sleepDebtRows[0] as { total_sleep: number; nights: number } | undefined;
  const actualSleepSeconds = Number(sleepDebtRow?.total_sleep ?? 0);
  const nightsCounted = Number(sleepDebtRow?.nights ?? 0);
  const sleepDebtSeconds = 7 * 8 * 3600 - actualSleepSeconds;
  const hasSleepDebtData = nightsCounted >= 3;

  const wellnessComponents = [
    { val: oura?.sleep_score, w: 0.35 },
    { val: oura?.readiness_score, w: 0.35 },
    { val: oura?.activity_score, w: 0.30 },
  ].filter((c): c is { val: number; w: number } => c.val != null);
  let wellnessScore: number | null = null;
  if (wellnessComponents.length >= 2) {
    const totalW = wellnessComponents.reduce((s, c) => s + c.w, 0);
    wellnessScore = Math.round(
      wellnessComponents.reduce((s, c) => s + c.val * c.w, 0) / totalW
    );
  }

  const sleepH = oura?.total_sleep_seconds
    ? (() => {
        const h = Math.floor(oura.total_sleep_seconds / 3600);
        const m = Math.round((oura.total_sleep_seconds % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      })()
    : null;

  const greeting = getGreeting(tz);

  return (
    <main className="mx-auto max-w-md pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)]">

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="px-5 pb-2 animate-fade-in">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-ink">
          {oura ? stateLabel(oura.readiness_score) : `${greeting}.`}
        </h1>
      </section>

      {/* ── Score rings ─────────────────────────────────────── */}
      <section
        className="flex justify-center gap-5 px-5 py-8 animate-score-pop"
        style={{ animationDelay: "80ms" }}
      >
        <div className="flex flex-col items-center gap-2">
          <Ring score={oura?.readiness_score} size={108} />
          <div className="text-center">
            <p className="text-[13px] font-medium text-ink">Readiness</p>
            <p className="text-[11px] text-ink-3">Recovery</p>
          </div>
          {readinessTrend.some((v) => v > 0) && (
            <div className="w-[88px]">
              <Sparkline values={readinessTrend} width={88} height={28} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Ring score={oura?.sleep_score} size={108} color="var(--color-accent-blue)" />
          <div className="text-center">
            <p className="text-[13px] font-medium text-ink">Sleep</p>
            <p className="text-[11px] text-ink-3">{sleepH ?? "—"}</p>
          </div>
          {sleepTrend.some((v) => v > 0) && (
            <div className="w-[88px]">
              <Sparkline values={sleepTrend} width={88} height={28} color="var(--color-accent-blue)" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Ring score={oura?.activity_score} size={108} color="var(--color-amber)" />
          <div className="text-center">
            <p className="text-[13px] font-medium text-ink">Activity</p>
            <p className="text-[11px] text-ink-3">Movement</p>
          </div>
          {activityTrend.some((v) => v > 0) && (
            <div className="w-[88px]">
              <Sparkline values={activityTrend} width={88} height={28} color="var(--color-amber)" />
            </div>
          )}
        </div>
      </section>

      {/* ── Wellness Score + Sleep Debt ──────────────────────── */}
      {(wellnessScore != null || hasSleepDebtData) && (
        <div className="flex gap-3 px-4 mb-3 animate-spring-in" style={{ animationDelay: "120ms" }}>
          {wellnessScore != null && (
            <div className="flex-1 rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Wellness</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="font-mono text-[28px] font-semibold tabular-nums text-ink leading-none">
                  {wellnessScore}
                </p>
                <span className="text-[16px] font-semibold text-accent">
                  {wellnessGrade(wellnessScore)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink-3">Composite score</p>
            </div>
          )}
          {hasSleepDebtData && (
            <div className="flex-1 rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Debt</p>
              <p
                className="mt-1.5 font-mono text-[24px] font-semibold tabular-nums leading-none"
                style={{ color: sleepDebtSeconds > 0 ? "var(--color-rose)" : "var(--color-accent)" }}
              >
                {sleepDebtSeconds > 0 ? "−" : "+"}{fmtDuration(sleepDebtSeconds)}
              </p>
              <p className="mt-1 text-[11px] text-ink-3">vs 8h/night · {nightsCounted}d</p>
            </div>
          )}
        </div>
      )}

      {/* ── Compact metrics (HRV, HR, Temp) ─────────────────── */}
      <div className="px-4 mb-3" style={{ animationDelay: "160ms" }}>
        <Metrics />
      </div>

      {/* ── Sleep stages + Readiness contributors ───────────── */}
      <OuraDetails />

      {/* ── Daily Briefing ──────────────────────────────────── */}
      <section
        className="mx-4 mt-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in"
        style={{ animationDelay: "280ms" }}
      >
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Daily Briefing
        </p>
        {briefing ? (
          <>
            {headline && (
              <h2 className="mb-2 text-[17px] font-semibold leading-snug tracking-tight text-ink">
                {headline}
              </h2>
            )}
            <p className="text-[14px] leading-relaxed text-ink-2">{briefing.summary_text}</p>
            {Array.isArray(briefing.recommendations) && briefing.recommendations.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
                {briefing.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-ink">
                    <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-line pt-3.5">
              <RunButton compact />
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Your morning briefing will appear here. Add a reflection tonight and it&apos;ll be ready by morning.
            </p>
            <RunButton compact={false} />
          </div>
        )}
      </section>

      {/* ── Today's Goals ───────────────────────────────────── */}
      <HabitCheckins />

      {/* ── Coming Up ───────────────────────────────────────── */}
      {events.length > 0 && (
        <section
          className="mx-4 mt-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in"
          style={{ animationDelay: "440ms" }}
        >
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Coming Up
          </p>
          <ul className="space-y-0">
            {(events as { title: string; kind: string; starts_at: string }[]).map((ev, i) => (
              <li
                key={i}
                className={`flex items-center justify-between py-2.5 ${
                  i < events.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background: "var(--color-surface-2)",
                      color: "var(--color-ink-3)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {ev.kind}
                  </span>
                  <span className="truncate text-[14px] text-ink">{ev.title}</span>
                </div>
                <span className="ml-3 shrink-0 font-mono text-[12px] tabular-nums text-ink-3">
                  {formatEventDate(ev.starts_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
