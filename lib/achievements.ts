// Achievements — a code-defined catalog evaluated against pre-computed stats.
// Pure data + pure functions (zero AI tokens, no DB here) so it stays cheap and
// unit-testable; the page gathers `AchievementStats` via SQL and calls
// `evaluateAchievements`. Keep the Circadian-Glass identity in the UI — this
// file only decides what's earned and how close the rest are.

export type AchievementCategory =
  | "consistency"
  | "sleep"
  | "recovery"
  | "activity"
  | "engagement"
  | "milestone";

// The numeric signals the catalog scores against. All are "higher unlocks",
// so an achievement fires when its stat ≥ its goal.
export type AchievementStats = {
  reflectionTotal: number; // total reflections written
  reflectionStreak: number; // consecutive days ending today/yesterday with a reflection
  moodLogTotal: number; // total mood entries
  nights8h: number; // nights with ≥8h asleep
  sleepDebtCleared: number; // 1 when the last-7-night debt is ≤ 0, else 0
  optimalDays: number; // days readiness ≥ 85
  readiness70Streak: number; // consecutive days readiness ≥ 70
  workoutTotal: number; // total workouts logged
  workoutDays: number; // distinct days with a workout
  stepDaysOver10k: number; // days with ≥10k steps
  bestSteps: number; // best single-day step count
  briefingsTotal: number; // briefings generated
  bestHrv: number; // best single-day HRV (ms)
  bestReadiness: number; // best single-day readiness
};

// 1 = entry tier … 5 = pinnacle. Drives the desaturated-metal badge.
export type Tier = 1 | 2 | 3 | 4 | 5;

export type AchievementDef = {
  id: string;
  title: string;
  description: string; // what it takes, in plain language
  category: AchievementCategory;
  stat: keyof AchievementStats;
  goal: number;
  unit?: string; // e.g. "days", "nights" — for the progress caption
  tier?: Tier; // difficulty band → metal badge (undefined = single/no tier)
  family?: string; // groups a tier ladder under one label in the UI
  hidden?: boolean; // render as "???" until unlocked, then reveal
};

export type EvaluatedAchievement = AchievementDef & {
  current: number; // raw stat value
  progress: number; // current capped at goal (for display)
  pct: number; // 0..1 toward the goal
  unlocked: boolean;
};

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  consistency: "Consistency",
  sleep: "Sleep",
  recovery: "Recovery",
  activity: "Activity",
  engagement: "Engagement",
  milestone: "Personal Bests",
};

// Desaturated, premium metals — muted on purpose so the grid reads calm, not
// arcade. Mirrored as CSS tokens (--tier-1…--tier-5) in globals.css.
export const TIER_LABEL: Record<Tier, string> = {
  1: "Bronze",
  2: "Silver",
  3: "Champagne",
  4: "Platinum",
  5: "Diamond",
};

export const TIER_TOKEN: Record<Tier, string> = {
  1: "var(--tier-1)",
  2: "var(--tier-2)",
  3: "var(--tier-3)",
  4: "var(--tier-4)",
  5: "var(--tier-5)",
};

// Ordered for display within a family. Labels groups in the UI.
export const FAMILY_LABEL: Record<string, string> = {
  steps: "Daily Steps",
  "step-days": "10K Step Days",
  nights8h: "Full Nights",
  "peak-readiness": "Peak Days",
  "readiness-streak": "Readiness Streak",
  "reflection-total": "Reflections",
  "reflection-streak": "Reflection Streak",
  mood: "Mood Logs",
  workouts: "Workout Days",
  briefings: "Daily Briefings",
  hrv: "HRV Milestones",
  "readiness-best": "Readiness Peaks",
};

// The catalog. Tier ladders share a `family` and carry a `tier` 1–5; the page
// groups them under one label so 50+ entries still scan as progression.
export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Activity · Daily Steps (best single day) ──────────────────────────────
  { id: "steps-3k", title: "First Steps", description: "Reach 3,000 steps in a day.", category: "activity", stat: "bestSteps", goal: 3000, unit: "steps", family: "steps", tier: 1 },
  { id: "steps-5k", title: "Up & About", description: "Reach 5,000 steps in a day.", category: "activity", stat: "bestSteps", goal: 5000, unit: "steps", family: "steps", tier: 1 },
  { id: "steps-7k", title: "Stride", description: "Reach 7,500 steps in a day.", category: "activity", stat: "bestSteps", goal: 7500, unit: "steps", family: "steps", tier: 2 },
  { id: "steps-10k", title: "10K Club", description: "Reach 10,000 steps in a day.", category: "activity", stat: "bestSteps", goal: 10000, unit: "steps", family: "steps", tier: 3 },
  { id: "steps-15k", title: "Trailblazer", description: "Reach 15,000 steps in a day.", category: "activity", stat: "bestSteps", goal: 15000, unit: "steps", family: "steps", tier: 4 },
  { id: "steps-20k", title: "Distance", description: "Reach 20,000 steps in a day.", category: "activity", stat: "bestSteps", goal: 20000, unit: "steps", family: "steps", tier: 5 },

  // ── Activity · 10K step days (consistency) ────────────────────────────────
  { id: "step-days-1", title: "On Your Feet", description: "Hit 10K steps on a day.", category: "activity", stat: "stepDaysOver10k", goal: 1, unit: "days", family: "step-days", tier: 1 },
  { id: "step-days-10", title: "Mover", description: "Hit 10K steps on 10 days.", category: "activity", stat: "stepDaysOver10k", goal: 10, unit: "days", family: "step-days", tier: 3 },
  { id: "step-days-30", title: "Relentless", description: "Hit 10K steps on 30 days.", category: "activity", stat: "stepDaysOver10k", goal: 30, unit: "days", family: "step-days", tier: 5 },

  // ── Activity · Workout days ───────────────────────────────────────────────
  { id: "workout-1", title: "First Rep", description: "Log your first workout.", category: "activity", stat: "workoutDays", goal: 1, unit: "days", family: "workouts", tier: 1 },
  { id: "workout-10", title: "Consistent Mover", description: "Work out on 10 days.", category: "activity", stat: "workoutDays", goal: 10, unit: "days", family: "workouts", tier: 2 },
  { id: "workout-30", title: "Dedicated", description: "Work out on 30 days.", category: "activity", stat: "workoutDays", goal: 30, unit: "days", family: "workouts", tier: 4 },
  { id: "workout-60", title: "Athlete", description: "Work out on 60 days.", category: "activity", stat: "workoutDays", goal: 60, unit: "days", family: "workouts", tier: 5 },

  // ── Sleep · Full nights (≥8h) ─────────────────────────────────────────────
  { id: "nights8h-1", title: "Full Night", description: "Sleep 8 hours in a night.", category: "sleep", stat: "nights8h", goal: 1, unit: "nights", family: "nights8h", tier: 1 },
  { id: "nights8h-7", title: "Well Rested", description: "Get 7 nights of 8h+ sleep.", category: "sleep", stat: "nights8h", goal: 7, unit: "nights", family: "nights8h", tier: 2 },
  { id: "nights8h-30", title: "Sleep Champion", description: "Get 30 nights of 8h+ sleep.", category: "sleep", stat: "nights8h", goal: 30, unit: "nights", family: "nights8h", tier: 3 },
  { id: "nights8h-60", title: "Restored", description: "Get 60 nights of 8h+ sleep.", category: "sleep", stat: "nights8h", goal: 60, unit: "nights", family: "nights8h", tier: 4 },
  { id: "nights8h-100", title: "Sleep Master", description: "Get 100 nights of 8h+ sleep.", category: "sleep", stat: "nights8h", goal: 100, unit: "nights", family: "nights8h", tier: 5 },

  // ── Sleep · Debt ──────────────────────────────────────────────────────────
  { id: "debt-free", title: "Debt Free", description: "Clear your weekly sleep debt.", category: "sleep", stat: "sleepDebtCleared", goal: 1 },

  // ── Recovery · Peak readiness days (≥85) ──────────────────────────────────
  { id: "peak-1", title: "Peak Day", description: "Reach 85+ readiness.", category: "recovery", stat: "optimalDays", goal: 1, unit: "days", family: "peak-readiness", tier: 1 },
  { id: "peak-7", title: "Peak Week", description: "Reach 85+ readiness on 7 days.", category: "recovery", stat: "optimalDays", goal: 7, unit: "days", family: "peak-readiness", tier: 2 },
  { id: "peak-30", title: "Peak Form", description: "Reach 85+ readiness on 30 days.", category: "recovery", stat: "optimalDays", goal: 30, unit: "days", family: "peak-readiness", tier: 4 },
  { id: "peak-60", title: "Apex", description: "Reach 85+ readiness on 60 days.", category: "recovery", stat: "optimalDays", goal: 60, unit: "days", family: "peak-readiness", tier: 5 },

  // ── Recovery · Readiness streak (≥70) ─────────────────────────────────────
  { id: "ready-streak-7", title: "Steady", description: "Hold 70+ readiness 7 days running.", category: "recovery", stat: "readiness70Streak", goal: 7, unit: "days", family: "readiness-streak", tier: 2 },
  { id: "ready-streak-14", title: "Resilient", description: "Hold 70+ readiness 14 days running.", category: "recovery", stat: "readiness70Streak", goal: 14, unit: "days", family: "readiness-streak", tier: 3 },
  { id: "ready-streak-30", title: "Unshakable", description: "Hold 70+ readiness 30 days running.", category: "recovery", stat: "readiness70Streak", goal: 30, unit: "days", family: "readiness-streak", tier: 5 },

  // ── Consistency · Reflections written ─────────────────────────────────────
  { id: "reflect-1", title: "First Words", description: "Write your first reflection.", category: "consistency", stat: "reflectionTotal", goal: 1, family: "reflection-total", tier: 1 },
  { id: "reflect-10", title: "Journaler", description: "Write 10 reflections.", category: "consistency", stat: "reflectionTotal", goal: 10, family: "reflection-total", tier: 2 },
  { id: "reflect-50", title: "Chronicler", description: "Write 50 reflections.", category: "consistency", stat: "reflectionTotal", goal: 50, family: "reflection-total", tier: 4 },
  { id: "reflect-100", title: "Memoirist", description: "Write 100 reflections.", category: "consistency", stat: "reflectionTotal", goal: 100, family: "reflection-total", tier: 5 },

  // ── Consistency · Reflection streak ───────────────────────────────────────
  { id: "reflect-streak-7", title: "Reflection Week", description: "Reflect 7 days in a row.", category: "consistency", stat: "reflectionStreak", goal: 7, unit: "days", family: "reflection-streak", tier: 2 },
  { id: "reflect-streak-14", title: "Reflection Habit", description: "Reflect 14 days in a row.", category: "consistency", stat: "reflectionStreak", goal: 14, unit: "days", family: "reflection-streak", tier: 3 },
  { id: "reflect-streak-30", title: "Reflection Ritual", description: "Reflect 30 days in a row.", category: "consistency", stat: "reflectionStreak", goal: 30, unit: "days", family: "reflection-streak", tier: 5 },

  // ── Consistency · Mood logs ───────────────────────────────────────────────
  { id: "mood-1", title: "Mood Aware", description: "Log your mood once.", category: "consistency", stat: "moodLogTotal", goal: 1, unit: "logs", family: "mood", tier: 1 },
  { id: "mood-14", title: "In Tune", description: "Log your mood 14 times.", category: "consistency", stat: "moodLogTotal", goal: 14, unit: "logs", family: "mood", tier: 2 },
  { id: "mood-50", title: "Self-Aware", description: "Log your mood 50 times.", category: "consistency", stat: "moodLogTotal", goal: 50, unit: "logs", family: "mood", tier: 4 },
  { id: "mood-100", title: "Attuned", description: "Log your mood 100 times.", category: "consistency", stat: "moodLogTotal", goal: 100, unit: "logs", family: "mood", tier: 5 },

  // ── Engagement · Daily briefings ──────────────────────────────────────────
  { id: "briefing-1", title: "Briefed", description: "Generate your first daily briefing.", category: "engagement", stat: "briefingsTotal", goal: 1, family: "briefings", tier: 1 },
  { id: "briefing-30", title: "Well Briefed", description: "Build up 30 daily briefings.", category: "engagement", stat: "briefingsTotal", goal: 30, unit: "briefings", family: "briefings", tier: 3 },
  { id: "briefing-90", title: "Briefing Devotee", description: "Build up 90 daily briefings.", category: "engagement", stat: "briefingsTotal", goal: 90, unit: "briefings", family: "briefings", tier: 5 },

  // ── Personal Bests · HRV ──────────────────────────────────────────────────
  { id: "hrv-40", title: "Settled Heart", description: "Reach an HRV of 40 ms.", category: "milestone", stat: "bestHrv", goal: 40, unit: "ms", family: "hrv", tier: 1 },
  { id: "hrv-50", title: "Calm Heart", description: "Reach an HRV of 50 ms.", category: "milestone", stat: "bestHrv", goal: 50, unit: "ms", family: "hrv", tier: 2 },
  { id: "hrv-60", title: "Strong Heart", description: "Reach an HRV of 60 ms.", category: "milestone", stat: "bestHrv", goal: 60, unit: "ms", family: "hrv", tier: 3 },
  { id: "hrv-70", title: "Athlete's Heart", description: "Reach an HRV of 70 ms.", category: "milestone", stat: "bestHrv", goal: 70, unit: "ms", family: "hrv", tier: 4 },

  // ── Personal Bests · Readiness peaks ──────────────────────────────────────
  { id: "ready-best-80", title: "In Form", description: "Reach 80 readiness.", category: "milestone", stat: "bestReadiness", goal: 80, family: "readiness-best", tier: 1 },
  { id: "ready-best-85", title: "Sharp", description: "Reach 85 readiness.", category: "milestone", stat: "bestReadiness", goal: 85, family: "readiness-best", tier: 2 },
  { id: "ready-best-90", title: "Readiness Ace", description: "Reach 90 readiness.", category: "milestone", stat: "bestReadiness", goal: 90, family: "readiness-best", tier: 3 },
  { id: "ready-best-95", title: "Prime", description: "Reach 95 readiness.", category: "milestone", stat: "bestReadiness", goal: 95, family: "readiness-best", tier: 4 },

  // ── Hidden — surprises that reveal only on unlock ─────────────────────────
  { id: "hidden-marathoner", title: "Marathoner", description: "Reach 30,000 steps in a single day.", category: "activity", stat: "bestSteps", goal: 30000, unit: "steps", tier: 5, hidden: true },
  { id: "hidden-perfect", title: "Flawless", description: "Reach a perfect 100 readiness.", category: "milestone", stat: "bestReadiness", goal: 100, tier: 5, hidden: true },
  { id: "hidden-iron-hrv", title: "Iron Heart", description: "Reach an HRV of 90 ms.", category: "milestone", stat: "bestHrv", goal: 90, unit: "ms", tier: 5, hidden: true },
  { id: "hidden-devoted", title: "Devoted", description: "Reflect 60 days in a row.", category: "consistency", stat: "reflectionStreak", goal: 60, unit: "days", tier: 5, hidden: true },
  { id: "hidden-centurion", title: "Centurion", description: "Build up 365 daily briefings.", category: "engagement", stat: "briefingsTotal", goal: 365, unit: "briefings", tier: 5, hidden: true },
];

export function evaluateAchievements(
  stats: AchievementStats,
  catalog: AchievementDef[] = ACHIEVEMENTS,
): EvaluatedAchievement[] {
  return catalog.map((a) => {
    const current = Number(stats[a.stat] ?? 0);
    const unlocked = current >= a.goal;
    const progress = Math.min(current, a.goal);
    const pct = a.goal > 0 ? Math.min(1, current / a.goal) : 0;
    return { ...a, current, progress, pct, unlocked };
  });
}

// Whole-day subtraction on a YYYY-MM-DD string (UTC-safe, no Date drift).
function minusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - n * 86_400_000;
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

// Count consecutive days (ending today, or yesterday as grace for a not-yet-
// logged today) present in `days`. Used for reflection and readiness streaks.
export function currentDayStreak(days: string[], todayIso: string): number {
  const set = new Set(days);
  let cursor: string | null = null;
  if (set.has(todayIso)) cursor = todayIso;
  else if (set.has(minusDays(todayIso, 1))) cursor = minusDays(todayIso, 1);
  if (cursor == null) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = minusDays(cursor, 1);
  }
  return streak;
}
