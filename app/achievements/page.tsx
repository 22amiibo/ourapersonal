import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  currentDayStreak,
  type AchievementStats,
  type EvaluatedAchievement,
} from "@/lib/achievements";

// Per-user, data-backed — render per request. Everything here is pure SQL/JS
// (zero AI tokens), matching the app's flat-cost rule.
export const dynamic = "force-dynamic";

const ZERO_STATS: AchievementStats = {
  reflectionTotal: 0,
  reflectionStreak: 0,
  moodLogTotal: 0,
  nights8h: 0,
  sleepDebtCleared: 0,
  optimalDays: 0,
  readiness70Streak: 0,
  workoutTotal: 0,
  workoutDays: 0,
  stepDaysOver10k: 0,
  briefingsTotal: 0,
  bestHrv: 0,
  bestReadiness: 0,
};

// Gather the achievement stats. Each query is isolated in try/catch so a single
// missing/optional table (mood_logs, intake_log…) degrades to 0 rather than
// 500-ing the whole page.
async function gatherStats(): Promise<AchievementStats> {
  const tz = await userTz();
  const today = localDateStr(tz);
  const stats: AchievementStats = { ...ZERO_STATS };

  try {
    const [tot, days] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM reflections WHERE user_id = ${USER_ID}`,
      sql`SELECT to_char(entry_date, 'YYYY-MM-DD') AS d FROM reflections
          WHERE user_id = ${USER_ID} ORDER BY entry_date DESC LIMIT 60`,
    ]);
    stats.reflectionTotal = Number((tot[0] as { n: number }).n);
    stats.reflectionStreak = currentDayStreak((days as { d: string }[]).map((r) => r.d), today);
  } catch {
    /* reflections unavailable */
  }

  try {
    const m = await sql`SELECT COUNT(*)::int AS n FROM mood_logs WHERE user_id = ${USER_ID}`;
    stats.moodLogTotal = Number((m[0] as { n: number }).n);
  } catch {
    /* mood_logs not migrated */
  }

  try {
    const a = await sql`
      SELECT
        (COUNT(*) FILTER (WHERE total_sleep_seconds >= 28800))::int AS nights8h,
        (COUNT(*) FILTER (WHERE readiness_score >= 85))::int AS optimal_days,
        COALESCE(MAX(hrv_avg), 0)::float8 AS best_hrv,
        COALESCE(MAX(readiness_score), 0)::float8 AS best_readiness
      FROM oura_daily WHERE user_id = ${USER_ID}`;
    const r = a[0] as { nights8h: number; optimal_days: number; best_hrv: number; best_readiness: number };
    stats.nights8h = Number(r.nights8h);
    stats.optimalDays = Number(r.optimal_days);
    stats.bestHrv = Math.round(Number(r.best_hrv));
    stats.bestReadiness = Math.round(Number(r.best_readiness));
  } catch {
    /* oura_daily unavailable */
  }

  try {
    const days = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS d, readiness_score
      FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 60`;
    const ge70 = (days as { d: string; readiness_score: number | null }[])
      .filter((x) => x.readiness_score != null && x.readiness_score >= 70)
      .map((x) => x.d);
    stats.readiness70Streak = currentDayStreak(ge70, today);
  } catch {
    /* skip */
  }

  // Isolated — the jsonb steps cast can throw on dirty payloads.
  try {
    const s = await sql`
      SELECT (COUNT(*) FILTER (WHERE (raw_payload->>'steps')::numeric >= 10000))::int AS n
      FROM oura_daily WHERE user_id = ${USER_ID}`;
    stats.stepDaysOver10k = Number((s[0] as { n: number }).n);
  } catch {
    /* steps not present */
  }

  try {
    const d = await sql`
      SELECT COALESCE(SUM(total_sleep_seconds), 0)::bigint AS total, COUNT(*)::int AS nights
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND day >= (CURRENT_DATE - INTERVAL '7 days')
        AND total_sleep_seconds IS NOT NULL`;
    const r = d[0] as { total: number; nights: number };
    const nights = Number(r.nights);
    const debt = 7 * 8 * 3600 - Number(r.total);
    stats.sleepDebtCleared = nights >= 3 && debt <= 0 ? 1 : 0;
  } catch {
    /* skip */
  }

  try {
    const w = await sql`
      SELECT (COUNT(*) FILTER (WHERE type = 'workout'))::int AS total,
             (COUNT(DISTINCT DATE(timestamp)) FILTER (WHERE type = 'workout'))::int AS days
      FROM intake_log WHERE user_id = ${USER_ID}`;
    const r = w[0] as { total: number; days: number };
    stats.workoutTotal = Number(r.total);
    stats.workoutDays = Number(r.days);
  } catch {
    /* intake_log unavailable */
  }

  try {
    const b = await sql`SELECT COUNT(*)::int AS n FROM briefings WHERE user_id = ${USER_ID}`;
    stats.briefingsTotal = Number((b[0] as { n: number }).n);
  } catch {
    /* skip */
  }

  return stats;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function progressCaption(a: EvaluatedAchievement): string {
  if (a.unit === "ms") return `${a.current} / ${a.goal} ${a.unit}`;
  if (a.goal === 1) return a.unlocked ? "Earned" : "Not yet";
  return `${a.progress} / ${a.goal}${a.unit ? " " + a.unit : ""}`;
}

// "2026-06-12" → "Jun 12" (UTC, no Date drift).
function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AchievementCard({ a, date }: { a: EvaluatedAchievement; date?: string }) {
  if (a.unlocked) {
    return (
      <div
        className="rounded-card glass-1 p-3.5"
        style={{
          border: "0.5px solid color-mix(in oklch, var(--color-accent) 45%, transparent)",
          boxShadow: "0 0 18px -6px color-mix(in oklch, var(--color-accent) 55%, transparent)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-bg"
            style={{ background: "var(--color-accent)" }}
          >
            <CheckIcon />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            {date ? `Earned ${fmtShortDate(date)}` : "Earned"}
          </span>
        </div>
        <p className="mt-2.5 text-[14px] font-semibold leading-tight text-ink">{a.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</p>
      </div>
    );
  }

  const inProgress = a.current > 0;
  return (
    <div className="rounded-card glass-1 p-3.5" style={{ opacity: inProgress ? 1 : 0.62 }}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold leading-tight text-ink">{a.title}</span>
        {!inProgress && <span className="text-ink-3"><LockIcon /></span>}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</p>
      {/* Reserved-height progress row → zero layout shift between states. */}
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(a.pct * 100)}%`, background: "var(--color-accent)" }}
          />
        </div>
        <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ink-3">{progressCaption(a)}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  dates,
}: {
  title: string;
  items: EvaluatedAchievement[];
  dates?: Record<string, string>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-5 px-4">
      <p className="mb-2.5 px-1 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
        {title} · {items.length}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((a) => (
          <AchievementCard key={a.id} a={a} date={dates?.[a.id]} />
        ))}
      </div>
    </section>
  );
}

// Record any newly-earned awards and read back the date each was first earned.
// Entirely optional: when the achievement_unlocks table hasn't been migrated
// this throws and we return {} (cards just show "Earned" with no date).
async function earnedDates(earnedIds: string[]): Promise<Record<string, string>> {
  if (earnedIds.length === 0) return {};
  try {
    await sql`
      INSERT INTO achievement_unlocks (user_id, achievement_id)
      SELECT ${USER_ID}, x FROM unnest(${earnedIds}::text[]) AS x
      ON CONFLICT (user_id, achievement_id) DO NOTHING`;
    const rows = await sql`
      SELECT achievement_id, to_char(unlocked_at, 'YYYY-MM-DD') AS d
      FROM achievement_unlocks WHERE user_id = ${USER_ID}`;
    return Object.fromEntries(
      (rows as { achievement_id: string; d: string }[]).map((r) => [r.achievement_id, r.d]),
    );
  } catch {
    return {};
  }
}

export default async function AchievementsPage() {
  const stats = await gatherStats();
  const evaluated = evaluateAchievements(stats);

  const earned = evaluated.filter((a) => a.unlocked);
  const inProgress = evaluated.filter((a) => !a.unlocked && a.current > 0).sort((a, b) => b.pct - a.pct);
  const locked = evaluated.filter((a) => !a.unlocked && a.current === 0);
  const total = evaluated.length;
  const pctEarned = total > 0 ? Math.round((earned.length / total) * 100) : 0;

  const dates = await earnedDates(earned.map((a) => a.id));

  return (
    <main className="mx-auto max-w-md pb-28 pt-5 sm:max-w-2xl">
      <header className="px-5 pb-1 animate-fade-in">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Awards</p>
        <h1 className="mt-1 text-display font-semibold text-ink">Achievements</h1>
        <p className="mt-2 text-[14px] text-ink-2">
          <span className="font-semibold text-ink">{earned.length}</span> of {total} earned
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
          <div className="h-full rounded-full" style={{ width: `${pctEarned}%`, background: "var(--color-accent)" }} />
        </div>
      </header>

      <Section title="In progress" items={inProgress} />
      <Section title="Earned" items={earned} dates={dates} />
      <Section title="Locked" items={locked} />

      {earned.length === 0 && inProgress.length === 0 && (
        <p className="mt-8 px-6 text-center text-[13px] leading-relaxed text-ink-3">
          Keep logging, sleeping, and reflecting — your first awards will appear here as the data comes in.
        </p>
      )}
    </main>
  );
}
