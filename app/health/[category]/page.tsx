import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { daysAgoStr } from "@/lib/dates";
import { computeTrends, type TrendResult } from "@/lib/trends";
import CategoryDetailClient from "@/app/components/health/CategoryDetailClient";
import { categoryFor, hrvZone } from "@/app/components/health/categories";
import CalendarHeatmap from "@/app/components/ui/CalendarHeatmap";
import Sparkline from "@/app/components/ui/Sparkline";
import { getRecentWeather } from "@/lib/weather";

// Per-user data backed by the DB — render per request, never prerender at build.
export const dynamic = "force-dynamic";

// ── Category extras (relocated from the old flat Health page) ──────────────

type StageRow = {
  rem_s: number | null;
  deep_s: number | null;
  light_s: number | null;
  awake_s: number | null;
  total_sleep_seconds: number | null;
};

function avgSleepStages(rows: StageRow[]) {
  const valid = rows.filter(
    (r) => r.total_sleep_seconds != null && Number(r.total_sleep_seconds) > 0
  );
  if (valid.length < 3) return null;
  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v != null).map(Number);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };
  const totalAvg = avg(valid.map((r) => r.total_sleep_seconds));
  if (!totalAvg) return null;
  return {
    rem_pct: Math.round((avg(valid.map((r) => r.rem_s)) / totalAvg) * 100),
    deep_pct: Math.round((avg(valid.map((r) => r.deep_s)) / totalAvg) * 100),
    light_pct: Math.round((avg(valid.map((r) => r.light_s)) / totalAvg) * 100),
    awake_pct: Math.round((avg(valid.map((r) => r.awake_s)) / totalAvg) * 100),
    nights: valid.length,
  };
}

function StageBar({ label, pct, color, optimal }: { label: string; pct: number; color: string; optimal: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-3">{optimal}</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">{pct}%</span>
        </div>
      </div>
      <div className="h-[6px] w-full rounded-full overflow-hidden bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

async function sleepExtras(): Promise<ReactNode> {
  const stageRows = (await sql`
    SELECT
      (raw_payload->>'rem_sleep_seconds')::numeric AS rem_s,
      (raw_payload->>'deep_sleep_seconds')::numeric AS deep_s,
      (raw_payload->>'light_sleep_seconds')::numeric AS light_s,
      (raw_payload->>'awake_seconds')::numeric AS awake_s,
      total_sleep_seconds
    FROM oura_daily
    WHERE user_id = ${USER_ID}
      AND total_sleep_seconds > 0
      AND raw_payload->>'rem_sleep_seconds' IS NOT NULL
    ORDER BY day DESC LIMIT 30
  `) as StageRow[];
  const stages = avgSleepStages(stageRows);
  if (!stages) return null;
  return (
    <section className="rounded-card glass-1 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Stage Averages</p>
        <span className="text-[11px] text-ink-3">{stages.nights} nights</span>
      </div>
      <StageBar label="REM" pct={stages.rem_pct} color="var(--color-accent-blue)" optimal="20–25%" />
      <StageBar label="Deep" pct={stages.deep_pct} color="var(--color-accent)" optimal="15–20%" />
      <StageBar label="Light" pct={stages.light_pct} color="var(--color-ink-3)" optimal="~55%" />
      <StageBar label="Awake" pct={stages.awake_pct} color="var(--color-rose)" optimal="<5%" />
    </section>
  );
}

// Local weather next to sleep — same 14-day window as the default trend view.
// Stored in °C, shown in °F (single US user). Renders nothing until the
// weather_daily table has data (migration + location + first sync).
async function weatherExtras(): Promise<ReactNode> {
  const days = await getRecentWeather(USER_ID, 14);
  const highs = days.map((d) => d.temp_hi).filter((v): v is number => v != null);
  if (highs.length < 2) return null;
  const toF = (c: number) => Math.round((c * 9) / 5 + 32);
  const latest = days[days.length - 1];
  return (
    <section className="rounded-card glass-1 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Weather · Daily High</p>
        <span className="text-[11px] text-ink-3">{highs.length} days</span>
      </div>
      <div className="mt-3 flex items-end gap-4">
        <div>
          <p className="font-mono text-[30px] font-semibold tabular-nums tracking-[-0.02em] text-ink leading-none">
            {latest.temp_hi != null ? toF(latest.temp_hi) : "–"}
            <span className="ml-1 text-[13px] font-normal text-ink-3">°F</span>
          </p>
          {latest.condition && <p className="mt-1 text-[11px] text-ink-3">{latest.condition}</p>}
        </div>
        <div className="flex-1">
          <Sparkline values={highs.map(toF)} width={180} height={40} color="var(--color-amber)" />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        Eyeball it against the sleep chart above — hot stretches often show up as lighter sleep.
      </p>
    </section>
  );
}

async function readinessExtras(): Promise<ReactNode> {
  const rows = (await sql`
    SELECT to_char(day, 'YYYY-MM-DD') AS day, readiness_score
    FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 90
  `) as { day: string; readiness_score: number | null }[];
  if (rows.length === 0) return null;
  const days = rows.reverse().map((d) => ({ day: d.day, score: d.readiness_score }));
  return (
    <section className="rounded-card glass-1 p-5">
      <CalendarHeatmap days={days} label="90-Day Readiness" />
    </section>
  );
}

async function heartExtras(): Promise<ReactNode> {
  const thirtyAgo = daysAgoStr("UTC", 30);
  const sevenAgo = daysAgoStr("UTC", 7);
  const rows = await sql`
    SELECT
      AVG(hrv_avg) FILTER (WHERE day >= ${thirtyAgo}::date)::numeric AS baseline_30d,
      AVG(hrv_avg) FILTER (WHERE day >= ${sevenAgo}::date)::numeric AS current_7d
    FROM oura_daily WHERE user_id = ${USER_ID} AND hrv_avg IS NOT NULL
  `;
  const hrv = rows[0] as { baseline_30d: number | null; current_7d: number | null } | undefined;
  if (hrv?.baseline_30d == null || hrv?.current_7d == null) return null;
  const baseline = Number(hrv.baseline_30d);
  const current = Number(hrv.current_7d);
  const zone = hrvZone(baseline, current);
  const deviation = ((current - baseline) / baseline) * 100;
  return (
    <section className="rounded-card glass-1 p-5">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">HRV Baseline</p>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[11px] text-ink-3">7-day avg</p>
          <p className="mt-1 font-mono text-[30px] font-semibold tabular-nums tracking-[-0.02em] text-ink leading-none">
            {Math.round(current)}
            <span className="ml-1 text-[13px] font-normal text-ink-3">ms</span>
          </p>
        </div>
        <div className="pb-1">
          <p className="text-[11px] text-ink-3">30-day baseline</p>
          <p className="mt-0.5 font-mono text-[18px] font-medium tabular-nums text-ink-2">
            {Math.round(baseline)}ms
          </p>
        </div>
      </div>
      <div
        className="mt-4 rounded-control px-3.5 py-2.5"
        style={{ background: `color-mix(in oklch, ${zone.color} 10%, transparent)` }}
      >
        <p className="text-[14px] font-semibold" style={{ color: zone.color }}>{zone.label}</p>
        <p className="mt-0.5 text-[11px] text-ink-3">
          {deviation >= 0 ? "+" : ""}{deviation.toFixed(1)}% vs personal baseline
        </p>
      </div>
    </section>
  );
}

// ── The route ───────────────────────────────────────────────────────────────

export default async function HealthCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: key } = await params;
  const category = categoryFor(key);
  if (!category) notFound();

  let initial: TrendResult[] = [];
  try {
    initial = await Promise.all(category.metrics.map((m) => computeTrends(m.metric, "W")));
  } catch {
    initial = [];
  }

  let extras: ReactNode = null;
  try {
    if (category.key === "sleep") {
      const [stages, weather] = await Promise.all([sleepExtras(), weatherExtras()]);
      extras = (
        <>
          {stages}
          {weather}
        </>
      );
    } else if (category.key === "readiness") extras = await readinessExtras();
    else if (category.key === "heart") extras = await heartExtras();
  } catch {
    extras = null;
  }

  return (
    <CategoryDetailClient category={category} initial={initial}>
      {extras}
    </CategoryDetailClient>
  );
}
