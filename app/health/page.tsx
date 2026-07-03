import Link from "next/link";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { computeCorrelations } from "@/lib/correlations";
import { daysAgoStr } from "@/lib/dates";
import { summarizeTrend, trendSentiment, type TrendPoint } from "@/lib/trends";
import { zoneFor, zoneColor, zoneLabel } from "@/lib/scores";
import { formatValue, SENTIMENT_COLOR } from "@/app/components/trends/metricMeta";
import { hrvZone, restingHrZone } from "@/app/components/health/categories";
import HealthMetricCard from "@/app/components/health/HealthMetricCard";
import Ring from "@/app/components/ui/Ring";
import MetricBarChart from "@/app/components/trends/MetricBarChart";
import SectionHeader from "@/app/components/ui/SectionHeader";
import CorrelationBar from "@/app/components/ui/CorrelationBar";

// Per-user data backed by the DB — render per request, never prerender at build.
export const dynamic = "force-dynamic";

// "Option 3A" overview dashboard: a 2×2 metric-card grid (Readiness / Sleep /
// Resting HR / HRV), a wide Activity card (steps + ring), a Key Insights
// callout, then signals, records and correlation patterns below the fold.
// Each card drills into /health/[category].

type DayRow = {
  day: string;
  sleep_score: number | null;
  readiness_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  activity_score: number | null;
  steps: number | null;
  total_sleep_seconds: number | null;
};

type HrvBaseline = { baseline_30d: number; current_7d: number } | null;

type Alert = { severity: "warning" | "positive"; message: string; detail: string };

function computeStreak(days: DayRow[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i].sleep_score;
    if (s != null && s >= 75) streak++;
    else break;
  }
  return streak;
}

// Signals logic relocated verbatim from the old HealthTab.
function detectAlerts(allDays: DayRow[], hrvBaseline: HrvBaseline, streak: number): Alert[] {
  const alerts: Alert[] = [];
  const last7 = allDays.slice(-7);

  let lowReadinessStreak = 0;
  for (let i = last7.length - 1; i >= 0; i--) {
    if ((last7[i].readiness_score ?? 100) < 60) lowReadinessStreak++;
    else break;
  }
  if (lowReadinessStreak >= 3) {
    alerts.push({
      severity: "warning",
      message: `${lowReadinessStreak}-day low readiness streak`,
      detail: "Reduce training intensity and prioritize sleep.",
    });
  }

  const recentSleep = last7.map((d) => d.sleep_score).filter((s): s is number => s != null);
  if (recentSleep.length >= 3) {
    const last3 = recentSleep.slice(-3);
    if (last3.slice(1).every((v, i) => v < last3[i] - 2)) {
      alerts.push({
        severity: "warning",
        message: "Sleep declining 3 nights in a row",
        detail: "Establish a consistent wind-down routine.",
      });
    }
  }

  if (hrvBaseline && hrvBaseline.baseline_30d > 0 && hrvBaseline.current_7d < hrvBaseline.baseline_30d * 0.88) {
    const dropPct = Math.round(
      ((hrvBaseline.baseline_30d - hrvBaseline.current_7d) / hrvBaseline.baseline_30d) * 100,
    );
    alerts.push({
      severity: "warning",
      message: `HRV ${dropPct}% below personal baseline`,
      detail: "Nervous system under stress — prioritize recovery.",
    });
  }

  if (streak >= 5) {
    alerts.push({
      severity: "positive",
      message: `${streak}-day sleep streak above 75`,
      detail: "Excellent consistency. Your body is adapting well.",
    });
  }

  return alerts;
}

// The value each category's overview row leads with.
function headlineValue(rows: DayRow[], metric: string): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const v =
      metric === "sleep_score" ? r.sleep_score
      : metric === "readiness" ? r.readiness_score
      : metric === "activity_score" ? r.activity_score
      : metric === "hrv" ? r.hrv_avg
      : metric === "resting_hr" ? r.resting_hr
      : metric === "steps" ? r.steps
      : null;
    if (v != null) return Number(v);
  }
  return null;
}

function sparkValues(rows: DayRow[], metric: string): number[] {
  return rows.slice(-14).map((r) => {
    const v =
      metric === "sleep_score" ? r.sleep_score
      : metric === "readiness" ? r.readiness_score
      : metric === "activity_score" ? r.activity_score
      : metric === "hrv" ? r.hrv_avg
      : metric === "resting_hr" ? r.resting_hr
      : metric === "steps" ? r.steps
      : null;
    return v == null ? 0 : Number(v);
  });
}

export default async function HealthPage() {
  const thirtyAgo = daysAgoStr("UTC", 30);
  const sevenAgo = daysAgoStr("UTC", 7);

  const [rowsDesc, hrvRows, bestSleepRows, bestReadinessRows, bestHrvRows] = await Promise.all([
    sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, sleep_score, readiness_score, hrv_avg, resting_hr,
             (raw_payload->>'activity_score')::numeric AS activity_score,
             (raw_payload->>'steps')::numeric AS steps,
             total_sleep_seconds
      FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 90
    `,
    sql`
      SELECT
        AVG(hrv_avg) FILTER (WHERE day >= ${thirtyAgo}::date)::numeric AS baseline_30d,
        AVG(hrv_avg) FILTER (WHERE day >= ${sevenAgo}::date)::numeric AS current_7d
      FROM oura_daily WHERE user_id = ${USER_ID} AND hrv_avg IS NOT NULL
    `,
    sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, sleep_score AS score
      FROM oura_daily WHERE user_id = ${USER_ID} AND sleep_score IS NOT NULL
      ORDER BY sleep_score DESC LIMIT 1
    `,
    sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, readiness_score AS score
      FROM oura_daily WHERE user_id = ${USER_ID} AND readiness_score IS NOT NULL
      ORDER BY readiness_score DESC LIMIT 1
    `,
    sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, hrv_avg::numeric AS hrv
      FROM oura_daily WHERE user_id = ${USER_ID} AND hrv_avg IS NOT NULL
      ORDER BY hrv_avg DESC LIMIT 1
    `,
  ]);

  const allDays = (rowsDesc as DayRow[]).reverse();
  const streak = computeStreak(allDays);

  const hrv = hrvRows[0] as { baseline_30d: number | null; current_7d: number | null } | undefined;
  const hrvBaseline: HrvBaseline =
    hrv?.baseline_30d != null && hrv?.current_7d != null
      ? { baseline_30d: Number(hrv.baseline_30d), current_7d: Number(hrv.current_7d) }
      : null;

  type RecordRow = { day: string; score: number } | undefined;
  type HrvRecordRow = { day: string; hrv: number } | undefined;
  const bestSleep = (bestSleepRows[0] as RecordRow) ?? null;
  const bestReadiness = (bestReadinessRows[0] as RecordRow) ?? null;
  const bestHrvRow = (bestHrvRows[0] as HrvRecordRow) ?? null;
  const bestHrv = bestHrvRow ? { day: bestHrvRow.day, hrv: Number(bestHrvRow.hrv) } : null;
  const hasRecords = bestSleep || bestReadiness || bestHrv;

  let correlations: Awaited<ReturnType<typeof computeCorrelations>> = [];
  try {
    correlations = await computeCorrelations(USER_ID);
  } catch {
    correlations = [];
  }
  const significantCorrelations = correlations.filter((r) => r.significant);

  const alerts = detectAlerts(allDays, hrvBaseline, streak);
  const hasData = allDays.length > 0;

  // ── Overview grid: headline + status + spark for the four small cards ──
  const readinessValue = headlineValue(allDays, "readiness");
  const sleepValue = headlineValue(allDays, "sleep_score");
  const hrvValue = headlineValue(allDays, "hrv");
  const restingHrValue = headlineValue(allDays, "resting_hr");
  const activityValue = headlineValue(allDays, "activity_score");
  const stepsValue = headlineValue(allDays, "steps");

  const readinessZone = readinessValue == null ? null : zoneFor(readinessValue);
  const sleepZone = sleepValue == null ? null : zoneFor(sleepValue);
  const hrvStatus =
    hrvBaseline && hrvBaseline.baseline_30d > 0
      ? hrvZone(hrvBaseline.baseline_30d, hrvBaseline.current_7d)
      : null;
  const restingHrStatus = restingHrValue == null ? null : restingHrZone(restingHrValue);

  // Sleep card subtitle — most recent night's real duration ("7h 23m asleep").
  let sleepSubtitle: string | null = null;
  for (let i = allDays.length - 1; i >= 0; i--) {
    const s = allDays[i].total_sleep_seconds;
    if (s != null && Number(s) > 0) {
      const mins = Math.round(Number(s) / 60);
      sleepSubtitle = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m asleep`;
      break;
    }
  }

  // ── Wide Activity card: mini step bars (last 7 days) ──
  const stepsSpark = allDays.slice(-7).map((d) => (d.steps == null ? null : Number(d.steps)));

  // ── Key Insights callout: 7d-vs-prior-7d readiness, real data only ──
  const toPoints = (rows: DayRow[]): TrendPoint[] =>
    rows.map((r) => ({ date: r.day, value: r.readiness_score }));
  const last7 = allDays.slice(-7);
  const prior7 = allDays.slice(-14, -7);
  const enoughForInsight =
    last7.filter((r) => r.readiness_score != null).length >= 4 &&
    prior7.filter((r) => r.readiness_score != null).length >= 4;
  const insight = enoughForInsight
    ? summarizeTrend("readiness", "W", toPoints(last7), toPoints(prior7), "")
    : null;
  const insightSentiment = insight ? trendSentiment("readiness", insight.direction) : null;
  const insightColor = insightSentiment ? SENTIMENT_COLOR[insightSentiment] : "var(--color-ink-3)";
  const insightHeadline =
    insightSentiment === "good"
      ? "Your recovery is trending up"
      : insightSentiment === "bad"
        ? "Your recovery is trending down"
        : "Your recovery is holding steady";
  const insightBody = insight
    ? `Readiness averaged ${Math.round(insight.average)} this week, ${insight.delta >= 0 ? "+" : ""}${Math.round(insight.delta)} vs the week before.`
    : null;

  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-4 pt-2 animate-fade-in">
        <h1 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-ink">
          Health Overview
        </h1>
        {streak >= 2 && (
          <p className="mt-1 text-[13px] font-medium text-amber">{streak}-day sleep streak</p>
        )}
      </header>

      {!hasData ? (
        <div className="mx-4 rounded-card glass-1 p-6 text-center animate-fade-in">
          <p className="text-[15px] font-semibold text-ink">No health data yet</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Connect your Oura Ring in Settings to see sleep, recovery, activity and heart trends here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Metric grid (Option 3A dashboard cards) ─────── */}
          <div
            className="mx-4 grid grid-cols-2 gap-3 animate-spring-in"
            style={{ animationDelay: "var(--stagger-1)" }}
          >
            <HealthMetricCard
              href="/health/readiness"
              label="Readiness"
              value={readinessValue == null ? null : String(Math.round(readinessValue))}
              statusLabel={readinessZone ? zoneLabel[readinessZone] : null}
              statusColor={readinessZone ? zoneColor[readinessZone] : "var(--color-ink-3)"}
              spark={sparkValues(allDays, "readiness")}
            />
            <HealthMetricCard
              href="/health/sleep"
              label="Sleep Score"
              value={sleepValue == null ? null : String(Math.round(sleepValue))}
              statusLabel={sleepZone ? zoneLabel[sleepZone] : null}
              statusColor={sleepZone ? zoneColor[sleepZone] : "var(--color-ink-3)"}
              spark={sparkValues(allDays, "sleep_score")}
              subtitle={sleepSubtitle}
            />
            <HealthMetricCard
              href="/health/heart"
              label="Resting HR"
              value={restingHrValue == null ? null : String(Math.round(restingHrValue))}
              unit="BPM"
              statusLabel={restingHrStatus?.label ?? null}
              statusColor={restingHrStatus?.color ?? "var(--color-ink-3)"}
              spark={sparkValues(allDays, "resting_hr")}
            />
            <HealthMetricCard
              href="/health/heart"
              label="HRV"
              value={hrvValue == null ? null : String(Math.round(hrvValue))}
              unit="ms"
              statusLabel={hrvStatus?.label ?? null}
              statusColor={hrvStatus?.color ?? "var(--color-ink-3)"}
              spark={sparkValues(allDays, "hrv")}
            />
          </div>

          {/* ── Activity (wide card: steps + mini bars + ring) ── */}
          <Link
            href="/health/activity"
            className="mx-4 mt-3 flex items-center justify-between gap-4 rounded-card glass-1 p-5 transition-transform active:scale-[0.99] animate-spring-in"
            style={{ animationDelay: "var(--stagger-2)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Activity</p>
              <p className="mt-1.5 font-mono text-[22px] font-semibold tabular-nums text-ink">
                {stepsValue == null ? "—" : formatValue("steps", stepsValue, "")}
              </p>
              <p className="text-[11px] text-ink-3">Steps</p>
              <div className="mt-2">
                <MetricBarChart
                  values={stepsSpark}
                  labels={stepsSpark.map(() => "")}
                  accent
                  height={56}
                />
              </div>
            </div>
            <Ring
              score={activityValue}
              size={84}
              stroke={7}
              label="Activity"
              color="var(--color-amber)"
              countKey="activity-overview"
            />
          </Link>

          {/* ── Key Insights ─────────────────────────────────── */}
          {insight && insightBody && (
            <section
              className="mx-4 mt-3 flex items-start gap-3 rounded-card glass-1 p-4 animate-spring-in"
              style={{ animationDelay: "var(--stagger-3)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: `color-mix(in oklch, ${insightColor} 16%, transparent)`, color: insightColor }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{insightHeadline}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{insightBody}</p>
              </div>
            </section>
          )}

          {/* ── Signals ─────────────────────────────────────── */}
          {alerts.length > 0 && (
            <section className="mx-4 mb-4 space-y-2 animate-spring-in" style={{ animationDelay: "var(--stagger-4)" }}>
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-card border p-4"
                  style={{
                    borderColor:
                      alert.severity === "warning"
                        ? "color-mix(in oklch, var(--color-danger) 30%, transparent)"
                        : "color-mix(in oklch, var(--color-accent) 30%, transparent)",
                    background:
                      alert.severity === "warning"
                        ? "color-mix(in oklch, var(--color-danger) 5%, transparent)"
                        : "color-mix(in oklch, var(--color-accent) 5%, transparent)",
                  }}
                >
                  <div
                    className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        alert.severity === "warning" ? "var(--color-danger)" : "var(--color-accent)",
                    }}
                  />
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{
                        color:
                          alert.severity === "warning" ? "var(--color-danger)" : "var(--color-accent)",
                      }}
                    >
                      {alert.message}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-3">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Personal Records ────────────────────────────── */}
          {hasRecords && (
            <>
              <SectionHeader className="mt-6 mb-2 px-5">Records</SectionHeader>
              <section className="mx-4 rounded-card glass-1 p-5 animate-spring-in" style={{ animationDelay: "var(--stagger-6)" }}>
                <div className="grid grid-cols-3 gap-2">
                  {bestSleep && (
                    <div className="rounded-control border border-line bg-surface-2 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Sleep</p>
                      <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{bestSleep.score}</p>
                      <p className="mt-0.5 text-[10px] text-ink-3">{bestSleep.day.slice(5)}</p>
                    </div>
                  )}
                  {bestReadiness && (
                    <div className="rounded-control border border-line bg-surface-2 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Readiness</p>
                      <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{bestReadiness.score}</p>
                      <p className="mt-0.5 text-[10px] text-ink-3">{bestReadiness.day.slice(5)}</p>
                    </div>
                  )}
                  {bestHrv && (
                    <div className="rounded-control border border-line bg-surface-2 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">HRV</p>
                      <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-ink">{Math.round(bestHrv.hrv)}</p>
                      <p className="mt-0.5 text-[10px] text-ink-3">{bestHrv.day.slice(5)}</p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── Patterns (correlations) ─────────────────────── */}
          {significantCorrelations.length > 0 && (
            <>
              <SectionHeader className="mt-6 mb-2 px-5">Patterns</SectionHeader>
              <section className="mx-4 rounded-card glass-1 p-5 space-y-5 animate-spring-in" style={{ animationDelay: "var(--stagger-6)" }}>
                {significantCorrelations.map((r, i) => (
                  <div key={r.id}>
                    {i > 0 && <div className="h-px bg-line mb-5" />}
                    <CorrelationBar r={r} />
                  </div>
                ))}
                <p className="text-[10px] text-ink-3 pt-1">Correlation only — not causal. Min 4 nights required.</p>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
