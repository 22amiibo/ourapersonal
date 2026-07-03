import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import {
  evaluateAchievements,
  CATEGORY_LABEL,
  TIER_LABEL,
  TIER_TOKEN,
  type AchievementCategory,
  type EvaluatedAchievement,
  type Tier,
} from "@/lib/achievements";
import { gatherAchievementStats } from "@/lib/achievement-stats";
import { attachRarity } from "@/lib/achievements-rarity";
import UnlockToast, { type UnlockedAward } from "./UnlockToast";
import CategoryTray from "./CategoryTray";
import EmptyState from "@/app/components/ui/EmptyState";

// Per-user, data-backed — render per request. Everything here is pure SQL/JS
// (zero AI tokens), matching the app's flat-cost rule.
export const dynamic = "force-dynamic";

// Fixed category order — activity & sleep lead (most data-rich), personal bests close.
const CATEGORY_ORDER: AchievementCategory[] = [
  "activity",
  "sleep",
  "recovery",
  "consistency",
  "engagement",
  "milestone",
];

// Personal records set today — surfaced through the same unlock toast so a
// fresh record greets the user on their next visit. Optional table; degrade
// to none when the migration hasn't been run.
const RECORD_LABEL: Record<string, string> = {
  resting_hr_min: "Lowest resting HR",
  deep_sleep_max: "Longest deep sleep",
};

async function recordsSetToday(): Promise<UnlockedAward[]> {
  try {
    const rows = await sql`
      SELECT metric, best_value::float8, to_char(best_date, 'YYYY-MM-DD') AS best_date,
             previous_value::float8, to_char(previous_date, 'YYYY-MM-DD') AS previous_date
      FROM personal_records
      WHERE user_id = ${USER_ID} AND updated_at >= NOW() - INTERVAL '1 day'
        AND previous_value IS NOT NULL`;
    return (rows as {
      metric: string;
      best_value: number;
      best_date: string;
      previous_value: number | null;
      previous_date: string | null;
    }[]).map((r) => ({
      id: `record-${r.metric}`,
      title: `${RECORD_LABEL[r.metric] ?? r.metric}: ${r.best_value}`,
      previousValue: r.previous_value ?? undefined,
      previousDate: r.previous_date ?? undefined,
    }));
  } catch {
    return [];
  }
}

// A filled medal — the "finalized" mark for an earned award. Tinted with the
// tier metal; a polished rosette (ribbon + disc + star), never an emoji/check.
function MedalIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8.4 13.2 6.8 22l5.2-3 5.2 3-1.6-8.8" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="12" cy="8" r="6.2" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" />
      <path d="M12 4.9l1.06 2.15 2.37.34-1.72 1.67.41 2.36L12 10.96l-2.12 1.1.41-2.36L8.57 7.4l2.37-.35z" fill={color} />
    </svg>
  );
}

function LockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function progressCaption(a: EvaluatedAchievement): string {
  if (a.unit === "ms") return `${a.current} / ${a.goal} ${a.unit}`;
  if (a.goal === 1) return a.unlocked ? "Earned" : "Locked";
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

// Small metal pill — tier difficulty at a glance. `muted` dims it for locked cards.
function TierBadge({ tier, muted = false }: { tier: Tier; muted?: boolean }) {
  const metal = TIER_TOKEN[tier];
  if (muted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-3"
        style={{ background: "var(--color-bg-soft)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: metal, opacity: 0.55 }} />
        {TIER_LABEL[tier]}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: `color-mix(in oklch, ${metal} 18%, transparent)`, color: metal }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: metal }} />
      {TIER_LABEL[tier]}
    </span>
  );
}

// One achievement, always visible. Three states share a uniform card so a
// category reads at a glance: earned (medal + finalized metal treatment),
// in-progress (teal bar), or locked (clear lock + what's needed).
function AchievementCard({ a, date }: { a: EvaluatedAchievement; date?: string }) {
  const metal = a.tier ? TIER_TOKEN[a.tier] : "var(--color-accent)";

  if (a.unlocked) {
    return (
      <div
        className="relative overflow-hidden rounded-card glass-1 p-3.5"
        style={{
          border: `0.5px solid color-mix(in oklch, ${metal} 55%, transparent)`,
          boxShadow: `0 0 22px -8px color-mix(in oklch, ${metal} 70%, transparent)`,
        }}
      >
        {/* Top sheen — the "finalized" gleam. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2/3"
          style={{ background: `linear-gradient(180deg, color-mix(in oklch, ${metal} 13%, transparent), transparent)` }} />
        <div className="relative flex items-start justify-between">
          <MedalIcon color={metal} />
          {a.tier && <TierBadge tier={a.tier} />}
        </div>
        <p className="relative mt-2 text-[14px] font-semibold leading-tight text-ink">{a.title}</p>
        <p className="relative mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</p>
        <div className="relative mt-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: metal }}>
            {date ? `Earned ${fmtShortDate(date)}` : "Earned"}
          </p>
          <a
            href={`/api/achievements/card?id=${encodeURIComponent(a.id)}`}
            download={`${a.id}.png`}
            className="text-[10px] font-semibold uppercase tracking-wide text-ink-3 underline-offset-2 hover:underline"
          >
            Share
          </a>
        </div>
        {a.rarityLabel && (
          <p className="relative mt-1 text-[10px] text-ink-3">{a.rarityLabel}</p>
        )}
      </div>
    );
  }

  const inProgress = a.current > 0;
  return (
    <div className="rounded-card glass-1 p-3.5" style={{ opacity: inProgress ? 1 : 0.82 }}>
      <div className="flex items-start justify-between">
        {a.tier ? <TierBadge tier={a.tier} muted /> : <span />}
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-ink-3" style={{ background: "var(--color-bg-soft)" }}>
          <LockIcon />
        </span>
      </div>
      <p className="mt-2 text-[14px] font-semibold leading-tight text-ink-2">{a.title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{a.description}</p>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(a.pct * 100)}%`, background: "var(--color-accent)" }} />
      </div>
      <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ink-3">{progressCaption(a)}</p>
      {a.rarityLabel && <p className="mt-1 text-[10px] text-ink-3">{a.rarityLabel}</p>}
    </div>
  );
}

// Hidden achievement — a "???" mystery until earned, then revealed as a medal.
function SecretCard({ a, date }: { a: EvaluatedAchievement; date?: string }) {
  if (!a.unlocked) {
    return (
      <div className="rounded-card glass-1 p-3.5" style={{ opacity: 0.7 }}>
        <div className="flex items-start justify-between">
          <span className="text-[18px] font-bold leading-none text-ink-3">?</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-ink-3" style={{ background: "var(--color-bg-soft)" }}>
            <LockIcon />
          </span>
        </div>
        <p className="mt-2 text-[14px] font-semibold text-ink-2">Secret award</p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-3">Keep going — this one reveals itself when earned.</p>
      </div>
    );
  }
  return <AchievementCard a={a} date={date} />;
}

// A category block — dominant header + count, then a segmented container that
// groups all of that category's cards so categories read as the primary level.
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
  // Earned first, then closest-to-earning — so the collapsed 2×2 always shows
  // the category's proudest moments and next targets. Stable within groups.
  const sorted = [...defs].sort(
    (a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0) || b.pct - a.pct,
  );
  return (
    <section className="mt-8 px-4">
      <div className="mb-2 flex items-end justify-between px-0.5">
        <h2 className="text-[17px] font-bold tracking-tight text-ink">{CATEGORY_LABEL[category]}</h2>
        <span className="rounded-pill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-2" style={{ background: "var(--color-bg-soft)" }}>
          {earned}/{defs.length}
        </span>
      </div>
      <div className="mb-3 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-3)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${defs.length > 0 ? Math.round((earned / defs.length) * 100) : 0}%`, background: "var(--color-accent)" }}
        />
      </div>
      <CategoryTray
        cards={sorted.map((a) => (
          <AchievementCard key={a.id} a={a} date={dates[a.id]} />
        ))}
      />
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
  const stats = await gatherAchievementStats();
  const evaluated = await attachRarity(evaluateAchievements(stats));

  const earned = evaluated.filter((a) => a.unlocked);
  const total = evaluated.length;
  const pctEarned = total > 0 ? Math.round((earned.length / total) * 100) : 0;

  const [{ dates, newIds }, todayRecords] = await Promise.all([
    recordUnlocks(earned.map((a) => a.id)),
    recordsSetToday(),
  ]);

  // A flood of "new" unlocks means a first-load backfill, not genuine moments —
  // only celebrate when a handful crossed the line, and cap the reveal at 3.
  const unlockToasts: UnlockedAward[] =
    newIds.length > 0 && newIds.length <= 4
      ? evaluated
          .filter((a) => newIds.includes(a.id))
          .slice(0, 3)
          .map((a) => ({ id: a.id, title: a.title, tier: a.tier }))
      : [];
  const toastAwards = [...unlockToasts, ...todayRecords.slice(0, 2)];

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

      {earned.length === 0 && (
        <div className="mt-5 px-4 animate-spring-in">
          <EmptyState
            icon={<MedalIcon color="var(--color-ink-3)" size={24} />}
            heading="Nothing earned yet"
            body="Your first award is closer than you think — keep logging and it'll find you."
            actions={
              <a
                href="/reflect"
                className="flex min-h-[44px] items-center rounded-pill bg-accent px-5 py-2.5 text-[13px] font-semibold text-bg transition-transform active:scale-95"
              >
                Log today
              </a>
            }
          />
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          defs={visible.filter((a) => a.category === cat)}
          dates={dates}
        />
      ))}

      {secrets.length > 0 && (
        <section className="mt-8 px-4">
          <div className="mb-3 flex items-end justify-between px-0.5">
            <h2 className="text-[17px] font-bold tracking-tight text-ink">Secret</h2>
            <span className="rounded-pill px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-2" style={{ background: "var(--color-bg-soft)" }}>
              {secretsEarned}/{secrets.length}
            </span>
          </div>
          <CategoryTray
            cards={secrets.map((a) => (
              <SecretCard key={a.id} a={a} date={dates[a.id]} />
            ))}
          />
        </section>
      )}
    </main>
  );
}
