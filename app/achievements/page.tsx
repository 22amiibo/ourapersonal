import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  currentDayStreak,
  CATEGORY_LABEL,
  FAMILY_LABEL,
  TIER_LABEL,
  TIER_TOKEN,
  type AchievementCategory,
  type AchievementStats,
  type EvaluatedAchievement,
  type Tier,
} from "@/lib/achievements";
import UnlockToast, { type UnlockedAward } from "./UnlockToast";

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
  bestSteps: 0,
  briefingsTotal: 0,
  bestHrv: 0,
  bestReadiness: 0,
};

// Fixed category order for the page — activity & sleep lead (most data-rich),
// personal bests close it out.
const CATEGORY_ORDER: AchievementCategory[] = [
  "activity",
  "sleep",
  "recovery",
  "consistency",
  "engagement",
  "milestone",
];

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
          WHERE user_id = ${USER_ID} ORDER BY entry_date DESC LIMIT 90`,
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
      FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC LIMIT 90`;
    const ge70 = (days as { d: string; readiness_score: number | null }[])
      .filter((x) => x.readiness_score != null && x.readiness_score >= 70)
      .map((x) => x.d);
    stats.readiness70Streak = currentDayStreak(ge70, today);
  } catch {
    /* skip */
  }

  // Isolated — the jsonb steps cast can throw on dirty payloads, so guard the
  // cast with a numeric regex and read both the 10k-day count and best day.
  try {
    const s = await sql`
      SELECT
        (COUNT(*) FILTER (WHERE (raw_payload->>'steps')::numeric >= 10000))::int AS n,
        COALESCE(MAX((raw_payload->>'steps')::numeric), 0)::int AS best
      FROM oura_daily
      WHERE user_id = ${USER_ID} AND raw_payload->>'steps' ~ '^[0-9]+(\.[0-9]+)?$'`;
    const r = s[0] as { n: number; best: number };
    stats.stepDaysOver10k = Number(r.n);
    stats.bestSteps = Number(r.best);
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
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function progressCaption(a: EvaluatedAchievement): string {
  if (a.unit === "ms") return `${a.current} / ${a.goal} ${a.unit}`;
  if (a.goal === 1) return a.unlocked ? "Earned" : "Not yet";
  return `${a.progress.toLocaleString()} / ${a.goal.toLocaleString()}${a.unit ? " " + a.unit : ""}`;
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

// Small metal pill — the only place tier color appears, so difficulty reads at
// a glance without shouting.
function TierBadge({ tier }: { tier: Tier }) {
  const metal = TIER_TOKEN[tier];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: `color-mix(in oklch, ${metal} 16%, transparent)`, color: metal }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: metal }} />
      {TIER_LABEL[tier]}
    </span>
  );
}

// A family's progress as a row of metal dots — filled when that tier is earned.
function TierDots({ items }: { items: EvaluatedAchievement[] }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {items.map((a) => (
        <span
          key={a.id}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: a.unlocked && a.tier ? TIER_TOKEN[a.tier] : "transparent",
            boxShadow: a.unlocked ? "none" : "inset 0 0 0 1px var(--color-surface-3)",
          }}
        />
      ))}
    </span>
  );
}

// One rung of a family ladder. Earned & far-off rungs render compact; the next
// target gets a full progress card so the eye lands on what's achievable now.
function TierRow({
  a,
  variant,
  date,
}: {
  a: EvaluatedAchievement;
  variant: "earned" | "next" | "locked";
  date?: string;
}) {
  if (variant === "earned") {
    const metal = a.tier ? TIER_TOKEN[a.tier] : "var(--color-accent)";
    return (
      <div className="flex items-center gap-3 rounded-control glass-1 px-3.5 py-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklch, ${metal} 20%, transparent)`, color: metal }}
        >
          <CheckIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{a.title}</p>
        </div>
        {a.tier && <TierBadge tier={a.tier} />}
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-ink-3">
          {date ? fmtShortDate(date) : ""}
        </span>
      </div>
    );
  }

  if (variant === "next") {
    return (
      <div
        className="rounded-control glass-1 px-3.5 py-3"
        style={{ border: "0.5px solid color-mix(in oklch, var(--color-accent) 38%, transparent)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-ink">{a.title}</p>
          {a.tier && <TierBadge tier={a.tier} />}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</p>
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round(a.pct * 100)}%`, background: "var(--color-accent)" }} />
        </div>
        <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ink-3">{progressCaption(a)}</p>
      </div>
    );
  }

  // locked / future
  return (
    <div className="flex items-center gap-3 rounded-control px-3.5 py-2.5" style={{ background: "var(--color-bg-soft)", opacity: 0.7 }}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-3">
        <LockIcon />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">{a.title}</p>
      {a.tier && (
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-ink-3">{TIER_LABEL[a.tier]}</span>
      )}
    </div>
  );
}

// A tier ladder for one family — thin label + dots, then rungs in order.
function FamilyLadder({
  label,
  items,
  dates,
}: {
  label: string;
  items: EvaluatedAchievement[];
  dates: Record<string, string>;
}) {
  const earnedCount = items.filter((a) => a.unlocked).length;
  // First unearned rung is the "next" target; everything past it is locked.
  const nextIdx = items.findIndex((a) => !a.unlocked);
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-2">{label}</span>
          <TierDots items={items} />
        </div>
        <span className="text-[10px] font-medium tabular-nums text-ink-3">
          {earnedCount} / {items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((a, i) => (
          <TierRow
            key={a.id}
            a={a}
            date={dates[a.id]}
            variant={a.unlocked ? "earned" : i === nextIdx ? "next" : "locked"}
          />
        ))}
      </div>
    </div>
  );
}

// Standalone (non-tiered) achievement — e.g. Debt Free. 2-col grid card.
function SoloCard({ a, date }: { a: EvaluatedAchievement; date?: string }) {
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
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-bg" style={{ background: "var(--color-accent)" }}>
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
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round(a.pct * 100)}%`, background: "var(--color-accent)" }} />
        </div>
        <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ink-3">{progressCaption(a)}</p>
      </div>
    </div>
  );
}

// Hidden achievement — a "???" mystery until earned, then revealed.
function SecretCard({ a, date }: { a: EvaluatedAchievement; date?: string }) {
  if (!a.unlocked) {
    return (
      <div className="rounded-card glass-1 p-3.5" style={{ opacity: 0.55 }}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-ink-2">???</span>
          <span className="text-ink-3"><LockIcon /></span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-3">A secret award, waiting to be discovered.</p>
      </div>
    );
  }
  const metal = a.tier ? TIER_TOKEN[a.tier] : "var(--color-accent)";
  return (
    <div
      className="rounded-card glass-1 p-3.5"
      style={{
        border: `0.5px solid color-mix(in oklch, ${metal} 50%, transparent)`,
        boxShadow: `0 0 18px -6px color-mix(in oklch, ${metal} 60%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: `color-mix(in oklch, ${metal} 22%, transparent)`, color: metal }}>
          <CheckIcon />
        </span>
        {a.tier && <TierBadge tier={a.tier} />}
      </div>
      <p className="mt-2.5 text-[14px] font-semibold leading-tight text-ink">{a.title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</p>
      {date && <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: metal }}>Earned {fmtShortDate(date)}</p>}
    </div>
  );
}

// Group a category's defs into ordered family ladders + standalone singles,
// preserving catalog order.
function groupByFamily(defs: EvaluatedAchievement[]): {
  families: { key: string; label: string; items: EvaluatedAchievement[] }[];
  singles: EvaluatedAchievement[];
} {
  const families: { key: string; label: string; items: EvaluatedAchievement[] }[] = [];
  const byKey = new Map<string, EvaluatedAchievement[]>();
  const singles: EvaluatedAchievement[] = [];
  for (const a of defs) {
    if (!a.family) {
      singles.push(a);
      continue;
    }
    if (!byKey.has(a.family)) {
      const items: EvaluatedAchievement[] = [];
      byKey.set(a.family, items);
      families.push({ key: a.family, label: FAMILY_LABEL[a.family] ?? a.family, items });
    }
    byKey.get(a.family)!.push(a);
  }
  return { families, singles };
}

function CategorySection({
  category,
  defs,
  dates,
}: {
  category: AchievementCategory;
  defs: EvaluatedAchievement[];
  dates: Record<string, string>;
}) {
  if (defs.length === 0) return null;
  const earned = defs.filter((a) => a.unlocked).length;
  const { families, singles } = groupByFamily(defs);
  return (
    <section className="mt-7 px-4">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">{CATEGORY_LABEL[category]}</p>
        <span className="text-[10px] font-medium tabular-nums text-ink-3">{earned} / {defs.length}</span>
      </div>
      {families.map((f) => (
        <FamilyLadder key={f.key} label={f.label} items={f.items} dates={dates} />
      ))}
      {singles.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {singles.map((a) => (
            <SoloCard key={a.id} a={a} date={dates[a.id]} />
          ))}
        </div>
      )}
    </section>
  );
}

// Record any newly-earned awards and read back the date each was first earned.
// `RETURNING` on the conflict-free insert tells us which were brand-new this
// load → those drive the unlock toast. Entirely optional: when the
// achievement_unlocks table hasn't been migrated this throws and we return {}.
async function recordUnlocks(
  earnedIds: string[],
): Promise<{ dates: Record<string, string>; newIds: string[] }> {
  if (earnedIds.length === 0) return { dates: {}, newIds: [] };
  try {
    const inserted = await sql`
      INSERT INTO achievement_unlocks (user_id, achievement_id)
      SELECT ${USER_ID}, x FROM unnest(${earnedIds}::text[]) AS x
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING achievement_id`;
    const newIds = (inserted as { achievement_id: string }[]).map((r) => r.achievement_id);
    const rows = await sql`
      SELECT achievement_id, to_char(unlocked_at, 'YYYY-MM-DD') AS d
      FROM achievement_unlocks WHERE user_id = ${USER_ID}`;
    const dates = Object.fromEntries(
      (rows as { achievement_id: string; d: string }[]).map((r) => [r.achievement_id, r.d]),
    );
    return { dates, newIds };
  } catch {
    return { dates: {}, newIds: [] };
  }
}

export default async function AchievementsPage() {
  const stats = await gatherStats();
  const evaluated = evaluateAchievements(stats);

  const earned = evaluated.filter((a) => a.unlocked);
  const total = evaluated.length;
  const pctEarned = total > 0 ? Math.round((earned.length / total) * 100) : 0;

  const { dates, newIds } = await recordUnlocks(earned.map((a) => a.id));

  // A flood of "new" unlocks means a first-load backfill, not genuine moments —
  // only celebrate when a handful crossed the line, and cap the reveal at 3.
  const toastAwards: UnlockedAward[] =
    newIds.length > 0 && newIds.length <= 4
      ? evaluated
          .filter((a) => newIds.includes(a.id))
          .slice(0, 3)
          .map((a) => ({ id: a.id, title: a.title, tier: a.tier }))
      : [];

  const visible = evaluated.filter((a) => !a.hidden);
  const secrets = evaluated.filter((a) => a.hidden);
  const secretsEarned = secrets.filter((a) => a.unlocked).length;

  return (
    <main className="mx-auto max-w-md pb-28 pt-5 sm:max-w-2xl">
      <UnlockToast awards={toastAwards} />

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

      {CATEGORY_ORDER.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          defs={visible.filter((a) => a.category === cat)}
          dates={dates}
        />
      ))}

      {secrets.length > 0 && (
        <section className="mt-7 px-4">
          <div className="flex items-baseline justify-between px-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">Secret</p>
            <span className="text-[10px] font-medium tabular-nums text-ink-3">{secretsEarned} / {secrets.length}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {secrets.map((a) => (
              <SecretCard key={a.id} a={a} date={dates[a.id]} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
