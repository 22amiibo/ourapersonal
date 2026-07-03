import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import type { AchievementStats, EvaluatedAchievement } from "@/lib/achievements";

// Personal-frequency labels for day-level achievement stats: "how often does a
// day like this happen for YOU" — deliberately framed as frequency ("1 in 12
// days"), not a population percentile, since this is a single-user app.
// Cumulative counters and streaks are excluded on purpose: hits/total-days
// doesn't describe them meaningfully.

type HitCount = { hits: number; total: number };

// One explicit tagged-template query per supported stat — the Neon client only
// parameterizes values, so column expressions stay as fixed literals here.
const RARITY_QUERIES: Partial<
  Record<keyof AchievementStats, (goal: number) => Promise<Record<string, unknown>[]>>
> = {
  bestSteps: (goal) => sql`
    SELECT (COUNT(*) FILTER (WHERE (raw_payload->>'steps')::numeric >= ${goal}))::int AS hits,
           (COUNT(*) FILTER (WHERE raw_payload->>'steps' IS NOT NULL))::int AS total
    FROM oura_daily
    WHERE user_id = ${USER_ID} AND raw_payload->>'steps' ~ '^[0-9]+(\.[0-9]+)?$'`,
  stepDaysOver10k: (goal) => sql`
    SELECT (COUNT(*) FILTER (WHERE (raw_payload->>'steps')::numeric >= ${goal}))::int AS hits,
           (COUNT(*) FILTER (WHERE raw_payload->>'steps' IS NOT NULL))::int AS total
    FROM oura_daily
    WHERE user_id = ${USER_ID} AND raw_payload->>'steps' ~ '^[0-9]+(\.[0-9]+)?$'`,
  bestHrv: (goal) => sql`
    SELECT (COUNT(*) FILTER (WHERE hrv_avg >= ${goal}))::int AS hits,
           (COUNT(*) FILTER (WHERE hrv_avg IS NOT NULL))::int AS total
    FROM oura_daily WHERE user_id = ${USER_ID}`,
  bestReadiness: (goal) => sql`
    SELECT (COUNT(*) FILTER (WHERE readiness_score >= ${goal}))::int AS hits,
           (COUNT(*) FILTER (WHERE readiness_score IS NOT NULL))::int AS total
    FROM oura_daily WHERE user_id = ${USER_ID}`,
  optimalDays: (goal) => sql`
    SELECT (COUNT(*) FILTER (WHERE readiness_score >= ${goal}))::int AS hits,
           (COUNT(*) FILTER (WHERE readiness_score IS NOT NULL))::int AS total
    FROM oura_daily WHERE user_id = ${USER_ID}`,
  nights8h: (goal) => sql`
    SELECT (COUNT(*) FILTER (WHERE total_sleep_seconds >= ${goal}))::int AS hits,
           (COUNT(*) FILTER (WHERE total_sleep_seconds IS NOT NULL))::int AS total
    FROM oura_daily WHERE user_id = ${USER_ID}`,
};

// nights8h achievements have goals in *nights count*, but the per-day check is
// "did this night reach 8h" — the day-level threshold is fixed, not the goal.
const DAY_THRESHOLD_OVERRIDE: Partial<Record<keyof AchievementStats, number>> = {
  nights8h: 28800, // ≥8h in seconds, per night
  optimalDays: 85, // readiness ≥85, per day
  stepDaysOver10k: 10000, // ≥10k steps, per day
};

export async function computeRarity(
  stat: keyof AchievementStats,
  goal: number,
): Promise<HitCount | null> {
  const run = RARITY_QUERIES[stat];
  if (!run) return null;
  const dayGoal = DAY_THRESHOLD_OVERRIDE[stat] ?? goal;

  try {
    const rows = (await run(dayGoal)) as { hits: number; total: number }[];
    const r = rows[0];
    if (!r) return null;
    return { hits: Number(r.hits), total: Number(r.total) };
  } catch {
    return null;
  }
}

export function rarityLabel(hits: number, total: number): string {
  if (total === 0) return "";
  if (hits === 0) return "not yet observed";
  const ratio = Math.max(1, Math.round(total / hits));
  return ratio <= 1 ? "most days" : `1 in ${ratio} days`;
}

// Attach rarity labels to an evaluated catalog. Day-count stats (nights8h,
// optimalDays, stepDaysOver10k) share one fixed day-threshold, so their tiers
// dedupe to a single query; best-value stats query once per distinct goal.
export async function attachRarity(
  evaluated: EvaluatedAchievement[],
): Promise<EvaluatedAchievement[]> {
  const keyFor = (a: EvaluatedAchievement) =>
    `${a.stat}:${DAY_THRESHOLD_OVERRIDE[a.stat] ?? a.goal}`;

  const pairs = new Map<string, { stat: keyof AchievementStats; goal: number }>();
  for (const a of evaluated) {
    if (RARITY_QUERIES[a.stat]) pairs.set(keyFor(a), { stat: a.stat, goal: a.goal });
  }

  const results = new Map<string, string>();
  await Promise.all(
    [...pairs.entries()].map(async ([key, { stat, goal }]) => {
      const r = await computeRarity(stat, goal);
      if (r && r.total > 0) results.set(key, rarityLabel(r.hits, r.total));
    }),
  );

  return evaluated.map((a) => {
    const label = results.get(keyFor(a));
    return label ? { ...a, rarityLabel: label } : a;
  });
}
