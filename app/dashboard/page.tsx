import Link from "next/link";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { localDateStr, daysAgoStr, getGreeting } from "@/lib/dates";
import { gradeFromScore, computeWellness } from "@/lib/scores";
import Ring from "@/app/components/ui/Ring";
import CountUp from "@/app/components/ui/CountUp";
import HapticReveal from "@/app/components/ui/HapticReveal";
import Sparkline from "@/app/components/ui/Sparkline";
import RunButton from "./RunButton";
import MoreButton from "@/app/components/MoreButton";
import Metrics from "./Metrics";
import OuraDetails from "./OuraDetails";
import HabitCheckins from "./HabitCheckins";

// Per-user data backed by the DB — render per request, never prerender at build.
export const dynamic = "force-dynamic";

async function getTz() {
  const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  return (rows[0] as { timezone?: string })?.timezone || "America/New_York";
}

function trendDir(vals: number[]): "up" | "down" | "flat" {
  const valid = vals.filter((v) => v > 0);
  if (valid.length < 4) return "flat";
  const half = Math.floor(valid.length / 2);
  const recent = valid.slice(half);
  const prior = valid.slice(0, half);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
  const d = recentAvg - priorAvg;
  return Math.abs(d) < 2 ? "flat" : d > 0 ? "up" : "down";
}

function weekDelta(vals: number[]): number | null {
  const valid = vals.filter((v) => v > 0);
  if (valid.length < 4) return null;
  const half = Math.floor(valid.length / 2);
  const recent = valid.slice(half);
  const prior = valid.slice(0, half);
  const d = (recent.reduce((a, b) => a + b, 0) / recent.length) - (prior.reduce((a, b) => a + b, 0) / prior.length);
  return Math.round(d);
}

function getDayState(
  readiness: number | null,
  readTrend: "up" | "down" | "flat",
  greeting: string,
): string {
  if (readiness == null) return `${greeting}.`;
  if (readiness >= 85 && readTrend !== "down") return "Peak day ahead.";
  if (readiness >= 85) return "High readiness — holding strong.";
  if (readiness >= 70 && readTrend === "up") return "Building momentum.";
  if (readiness >= 70 && readTrend === "down") return "Good readiness, trending down.";
  if (readiness >= 70) return "Good to go today.";
  if (readiness >= 55 && readTrend === "down") return "Recovery in progress.";
  if (readiness >= 55) return "Moderate — pace yourself today.";
  if (readTrend === "up") return "Improving — rest is working.";
  return "Rest and recover today.";
}

function getDayInsight(
  readTrend: "up" | "down" | "flat",
  sleepDelta: number | null,
  sleepDebtSeconds: number,
  hasSleepDebtData: boolean,
): string | null {
  if (sleepDelta !== null && sleepDelta >= 5) return `Sleep up ${sleepDelta} pts this week.`;
  if (sleepDelta !== null && sleepDelta <= -5) return `Sleep down ${Math.abs(sleepDelta)} pts this week.`;
  if (hasSleepDebtData && sleepDebtSeconds > 4 * 3600) return `Carrying ${fmtDuration(sleepDebtSeconds)} of sleep debt.`;
  if (readTrend === "up") return "Readiness improving — stay consistent.";
  if (readTrend === "down") return "Downward trend — consider a recovery day.";
  return null;
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

function getRecoveryZone(readiness: number | null): {
  label: string;
  color: string;
  advice: string;
  dots: number;
} | null {
  if (readiness == null) return null;
  if (readiness >= 80) return { label: "Optimal", color: "var(--color-accent)", advice: "Ready for peak performance.", dots: 3 };
  if (readiness >= 65) return { label: "Moderate", color: "var(--color-amber)", advice: "Balanced effort today.", dots: 2 };
  if (readiness >= 55) return { label: "Low", color: "color-mix(in oklch, var(--color-amber) 55%, var(--color-rose))", advice: "Keep intensity manageable.", dots: 1 };
  return { label: "Recovery", color: "var(--color-rose)", advice: "Rest and light activity only.", dots: 0 };
}

function fmtDuration(secs: number): string {
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.round((abs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// The single most important thing to do right now + one action. A priority
// ladder over data we already have — surfaces one verdict, not a wall of cards.
type Verdict = { message: string; cta: { label: string; href: string } };
function resolveVerdict(opts: {
  hasOura: boolean;
  readiness: number | null;
  sleepDebtSeconds: number;
  hasSleepDebtData: boolean;
  reflectedToday: boolean;
}): Verdict | null {
  if (!opts.hasOura) return null;
  if (opts.readiness != null && opts.readiness < 55)
    return { message: "Low readiness — keep today easy and prioritize recovery.", cta: { label: "Recovery", href: "/trends" } };
  if (opts.hasSleepDebtData && opts.sleepDebtSeconds > 4 * 3600)
    return { message: `You're carrying ${fmtDuration(opts.sleepDebtSeconds)} of sleep debt.`, cta: { label: "Sleep trend", href: "/trends" } };
  if (!opts.reflectedToday)
    return { message: "Capture today — it sharpens tomorrow's briefing.", cta: { label: "Reflect", href: "/reflect" } };
  return null;
}

// Whole days between two YYYY-MM-DD strings (to − from).
function daysBetweenStr(fromIso: string, toIso: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(toIso) - p(fromIso)) / 86_400_000);
}

export default async function DashboardPage() {
  const tz = await getTz();
  const today = localDateStr(tz);
  const weekAgo = daysAgoStr(tz, 7);
  const twoWeeksAgo = daysAgoStr(tz, 14);

  const [briefingRows, ouraRows, trendRows, events, sleepDebtRows, baselineRows, reflectionRows] = await Promise.all([
    sql`
      SELECT summary_text, recommendations, context_window FROM briefings
      WHERE user_id = ${USER_ID} ORDER BY briefing_date DESC LIMIT 1`,
    sql`
      SELECT sleep_score, readiness_score, total_sleep_seconds,
             to_char(day, 'YYYY-MM-DD') AS day,
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
    sql`
      SELECT AVG(readiness_score) AS readiness,
             AVG(sleep_score) AS sleep,
             AVG((raw_payload->>'activity_score')::numeric) AS activity
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND day >= ${twoWeeksAgo}`,
    sql`
      SELECT 1 FROM reflections
      WHERE user_id = ${USER_ID} AND entry_date = ${today} LIMIT 1`,
  ]);

  // prediction_records is part of the intelligence layer and may not be
  // migrated in every environment — degrade to empty rather than 500.
  let predictionRows: unknown[] = [];
  try {
    predictionRows = await sql`
      SELECT prediction_type, prediction, confidence, target_date
      FROM prediction_records
      WHERE user_id = ${USER_ID} AND evaluated_at IS NULL AND target_date >= CURRENT_DATE
      ORDER BY target_date ASC LIMIT 5`;
  } catch {
    predictionRows = [];
  }

  const briefingRow = briefingRows[0] as {
    summary_text: string;
    recommendations: string[];
    context_window: Record<string, unknown>;
  } | undefined;
  const headline = briefingRow?.context_window?.headline as string | undefined;
  const briefing = briefingRow;

  const oura = ouraRows[0] as
    | { sleep_score: number | null; readiness_score: number | null; activity_score: number | null; total_sleep_seconds: number | null; day: string | null }
    | undefined;

  // Stale-data honesty: flag when the freshest Oura day is more than a normal
  // overnight lag old (≥2d), so the rings aren't mistaken for "as of today".
  const ouraAgeDays = oura?.day ? daysBetweenStr(oura.day, today) : null;
  const ouraStale = ouraAgeDays != null && ouraAgeDays >= 2;

  const greeting = getGreeting(tz);

  type TrendRow = { readiness_score: number | null; sleep_score: number | null; activity_score: number | null };
  const trend = trendRows as TrendRow[];
  const readinessTrend = trend.map((r) => r.readiness_score ?? 0);
  const sleepTrend = trend.map((r) => r.sleep_score ?? 0);
  const activityTrend = trend.map((r) => r.activity_score ?? 0);

  type PredictionRow = { prediction_type: string; prediction: string; confidence: number; target_date: string };
  const predictions = predictionRows as PredictionRow[];

  const sleepDebtRow = sleepDebtRows[0] as { total_sleep: number; nights: number } | undefined;
  const actualSleepSeconds = Number(sleepDebtRow?.total_sleep ?? 0);
  const nightsCounted = Number(sleepDebtRow?.nights ?? 0);
  const sleepDebtSeconds = 7 * 8 * 3600 - actualSleepSeconds;
  const hasSleepDebtData = nightsCounted >= 3;

  const readinessTrendDir = trendDir(readinessTrend);
  const readinessDelta = weekDelta(readinessTrend);
  const sleepDelta = weekDelta(sleepTrend);
  const activityDelta = weekDelta(activityTrend);

  const dayState = getDayState(oura?.readiness_score ?? null, readinessTrendDir, greeting);
  const dayInsight = getDayInsight(readinessTrendDir, sleepDelta, sleepDebtSeconds, hasSleepDebtData);
  const recoveryZone = getRecoveryZone(oura?.readiness_score ?? null);

  const reflectedToday = (reflectionRows as unknown[]).length > 0;
  const verdict = resolveVerdict({
    hasOura: !!oura,
    readiness: oura?.readiness_score ?? null,
    sleepDebtSeconds,
    hasSleepDebtData,
    reflectedToday,
  });

  const wellness = computeWellness({
    sleep: oura?.sleep_score,
    readiness: oura?.readiness_score,
    activity: oura?.activity_score,
  });

  // 14-day baselines for the ring ghost arcs ("today vs your normal").
  const baselineRow = baselineRows[0] as
    | { readiness: string | null; sleep: string | null; activity: string | null }
    | undefined;
  const toNum = (v: string | null | undefined) => (v == null ? null : Number(v));
  const baseReadiness = toNum(baselineRow?.readiness);
  const baseSleep = toNum(baselineRow?.sleep);
  const baseActivity = toNum(baselineRow?.activity);

  // Per-pillar accent matches its ring color, tying the breakdown to the rings.
  const pillarColor: Record<string, string> = {
    sleep: "var(--color-accent-blue)",
    readiness: "var(--color-accent)",
    activity: "var(--color-amber)",
  };

  const sleepH = oura?.total_sleep_seconds
    ? (() => {
        const h = Math.floor(oura.total_sleep_seconds / 3600);
        const m = Math.round((oura.total_sleep_seconds % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      })()
    : null;

  return (
    <main className="mx-auto max-w-md pb-28 pt-5 sm:max-w-3xl sm:px-2">

      {/* ── Circadian header ───────────────────────────────── */}
      <header className="px-5 pb-3 animate-fade-in">
        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <MoreButton />
        </div>
        <h1 className="text-display font-semibold text-ink text-balance">
          {dayState}
        </h1>
        {dayInsight && (
          <p className="mt-2 text-[14px] leading-snug text-ink-2">{dayInsight}</p>
        )}
        {recoveryZone && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-[7px] w-[7px] rounded-full transition-all"
                  style={{ background: i < recoveryZone.dots ? recoveryZone.color : "var(--color-surface-3)" }}
                />
              ))}
            </div>
            <span className="text-[12px] font-semibold" style={{ color: recoveryZone.color }}>{recoveryZone.label}</span>
            <span className="text-[12px] text-ink-3">{recoveryZone.advice}</span>
          </div>
        )}
        {verdict && (
          <Link
            href={verdict.cta.href}
            className="mt-3 flex items-center justify-between gap-3 rounded-control glass-1 px-4 py-3 transition-transform active:scale-[0.99]"
          >
            <span className="text-[13px] font-medium leading-snug text-ink">{verdict.message}</span>
            <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-accent">
              {verdict.cta.label}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        )}
      </header>

      {/* ── Score rings ─────────────────────────────────────── */}
      <section
        className="flex justify-center gap-5 px-5 py-8 animate-score-pop"
        style={{ animationDelay: "80ms" }}
      >
        <HapticReveal />
        <div className="flex flex-col items-center gap-2">
          <Ring score={oura?.readiness_score} size={96} baseline={baseReadiness} />
          <div className="text-center">
            <p className="text-[13px] font-medium text-ink">Readiness</p>
            <p className="text-[11px] text-ink-3">Recovery</p>
          </div>
          {readinessTrend.some((v) => v > 0) && (
            <div className="flex flex-col items-center gap-1 w-[80px]">
              <Sparkline values={readinessTrend} width={80} height={26} />
              {readinessDelta !== null && (
                <p className="font-mono text-[10px] font-medium tabular-nums"
                  style={{ color: readinessDelta > 0 ? "var(--color-accent)" : readinessDelta < 0 ? "var(--color-rose)" : "var(--color-ink-3)" }}>
                  {readinessDelta > 0 ? "+" : ""}{readinessDelta} wk
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Ring score={oura?.sleep_score} size={96} color="var(--color-accent-blue)" baseline={baseSleep} />
          <div className="text-center">
            <p className="text-[13px] font-medium text-ink">Sleep</p>
            <p className="text-[11px] text-ink-3">{sleepH ?? "—"}</p>
          </div>
          {sleepTrend.some((v) => v > 0) && (
            <div className="flex flex-col items-center gap-1 w-[80px]">
              <Sparkline values={sleepTrend} width={80} height={26} color="var(--color-accent-blue)" />
              {sleepDelta !== null && (
                <p className="font-mono text-[10px] font-medium tabular-nums"
                  style={{ color: sleepDelta > 0 ? "var(--color-accent-blue)" : sleepDelta < 0 ? "var(--color-rose)" : "var(--color-ink-3)" }}>
                  {sleepDelta > 0 ? "+" : ""}{sleepDelta} wk
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Ring score={oura?.activity_score} size={96} color="var(--color-amber)" baseline={baseActivity} />
          <div className="text-center">
            <p className="text-[13px] font-medium text-ink">Activity</p>
            <p className="text-[11px] text-ink-3">Movement</p>
          </div>
          {activityTrend.some((v) => v > 0) && (
            <div className="flex flex-col items-center gap-1 w-[80px]">
              <Sparkline values={activityTrend} width={80} height={26} color="var(--color-amber)" />
              {activityDelta !== null && (
                <p className="font-mono text-[10px] font-medium tabular-nums"
                  style={{ color: activityDelta > 0 ? "var(--color-amber)" : activityDelta < 0 ? "var(--color-rose)" : "var(--color-ink-3)" }}>
                  {activityDelta > 0 ? "+" : ""}{activityDelta} wk
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Stale-data honesty — only when Oura hasn't synced in ≥2 days. */}
      {ouraStale && (
        <p
          className="-mt-3 mb-2 px-5 text-center text-[12px] font-medium"
          style={{ color: "var(--color-amber)" }}
        >
          Oura last synced {ouraAgeDays}d ago — scores may be out of date
        </p>
      )}

      {/* ── Daily Briefing (promoted: the app's core value) ──── */}
      <section
        className="mx-4 mb-3 rounded-card glass-2 p-5 animate-spring-in"
        style={{ animationDelay: "120ms" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-3" />
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Daily Briefing</p>
        </div>
        {briefing ? (
          <>
            {headline && (
              <h2 className="mb-2 text-title-m font-semibold tracking-tight text-ink">
                {headline}
              </h2>
            )}
            <p className="text-[14px] leading-relaxed text-ink-2">{briefing.summary_text}</p>
            {Array.isArray(briefing.recommendations) && briefing.recommendations.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
                {briefing.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-ink">
                    <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
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
            {!oura ? (
              <>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  Connect your Oura Ring to unlock sleep scores, readiness insights, and your daily intelligence briefing.
                </p>
                <a
                  href="/settings"
                  className="flex w-full items-center justify-center rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold tracking-[-0.01em] text-bg min-h-[44px] transition-transform active:scale-95"
                >
                  Connect Oura Ring
                </a>
              </>
            ) : (
              <>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  Your morning briefing will appear here. Write a reflection tonight and it&apos;ll be ready by morning.
                </p>
                <RunButton compact={false} />
              </>
            )}
          </div>
        )}
      </section>

      {/* Below the hero, cards flow into two balanced columns on wider
          screens (≥640px). Mobile is unchanged — every rule is sm:-gated.
          break-inside-avoid keeps each card whole across the column break. */}
      <div className="sm:columns-2 sm:gap-2 sm:[&>*]:mb-3 sm:[&>*]:break-inside-avoid sm:[&>*]:!mx-2">

      {/* ── Wellness Score + Sleep Debt ──────────────────────── */}
      {(wellness != null || hasSleepDebtData) && (
        <div className="flex items-start gap-3 px-4 mb-3 animate-spring-in" style={{ animationDelay: "180ms" }}>
          {wellness != null && (() => {
            const g = gradeFromScore(wellness.score);
            return (
            <div className="flex-1 rounded-card glass-1 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Wellness</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <CountUp
                  value={wellness.score}
                  seenKey="wellness"
                  className="font-mono text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink leading-none"
                />
                <span
                  className="rounded px-1.5 py-0.5 text-[14px] font-bold"
                  style={{
                    color: g.color,
                    background: `color-mix(in oklch, ${g.color} 14%, transparent)`,
                  }}
                >
                  {g.letter}
                </span>
              </div>
              {readinessDelta !== null ? (
                <p
                  className="mt-1 font-mono text-[11px] font-medium tabular-nums"
                  style={{ color: readinessDelta > 0 ? "var(--color-accent)" : readinessDelta < 0 ? "var(--color-rose)" : "var(--color-ink-3)" }}
                >
                  {readinessDelta > 0 ? "+" : ""}{readinessDelta} vs last week
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-3">Composite score</p>
              )}
              {/* Explainable breakdown: each pillar's score + its weight. */}
              <div className="mt-3 space-y-1.5 border-t border-line pt-2.5">
                {wellness.pillars.map((p) => (
                  <div key={p.key} className="flex items-center gap-1.5">
                    <span className="w-[60px] shrink-0 text-[9px] font-medium uppercase tracking-wide text-ink-3">
                      {p.label} {Math.round(p.weight * 100)}%
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, p.value))}%`, background: pillarColor[p.key] }}
                      />
                    </div>
                    <span className="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-2">
                      {Math.round(p.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
          {hasSleepDebtData && (
            <div className="flex-1 rounded-card glass-1 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Debt</p>
              <p
                className="mt-1.5 font-mono text-[24px] font-semibold tabular-nums tracking-[-0.02em] leading-none"
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

      {/* ── Predictions ─────────────────────────────────────── */}
      {predictions.length > 0 && (
        <section
          className="mx-4 mt-4 rounded-card glass-1 p-5 animate-spring-in"
          style={{ animationDelay: "360ms" }}
        >
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Predictions
          </p>
          <ul className="space-y-0">
            {predictions.map((p, i) => (
              <li
                key={i}
                className={`flex items-start justify-between gap-3 py-2.5 ${
                  i < predictions.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <p className="text-[13px] leading-snug text-ink-2 flex-1">{p.prediction}</p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
                    style={{
                      background: "var(--color-surface-2)",
                      color: "var(--color-ink-2)",
                    }}
                  >
                    {Math.round(Number(p.confidence) * 100)}%
                  </span>
                  <span className="font-mono text-[10px] text-ink-3">
                    {new Date(p.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Today's Goals ───────────────────────────────────── */}
      <HabitCheckins />

      {/* ── Coming Up ───────────────────────────────────────── */}
      {events.length > 0 && (
        <section
          className="mx-4 mt-4 rounded-card glass-1 p-5 animate-spring-in"
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
      </div>
    </main>
  );
}
