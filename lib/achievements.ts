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
  briefingsTotal: number; // briefings generated
  bestHrv: number; // best single-day HRV (ms)
  bestReadiness: number; // best single-day readiness
};

export type AchievementDef = {
  id: string;
  title: string;
  description: string; // what it takes, in plain language
  category: AchievementCategory;
  stat: keyof AchievementStats;
  goal: number;
  unit?: string; // e.g. "days", "nights" — for the progress caption
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

// The catalog. Single-level milestones first; tiers can come later as teal
// intensity rather than bronze/silver/gold metals.
export const ACHIEVEMENTS: AchievementDef[] = [
  // Consistency
  { id: "first-reflection", title: "First Words", description: "Write your first reflection.", category: "consistency", stat: "reflectionTotal", goal: 1 },
  { id: "reflect-week", title: "Reflection Week", description: "Reflect 7 days in a row.", category: "consistency", stat: "reflectionStreak", goal: 7, unit: "days" },
  { id: "reflect-fortnight", title: "Reflection Habit", description: "Reflect 14 days in a row.", category: "consistency", stat: "reflectionStreak", goal: 14, unit: "days" },
  { id: "mood-aware", title: "Mood Aware", description: "Log your mood once.", category: "consistency", stat: "moodLogTotal", goal: 1 },
  { id: "mood-habit", title: "In Tune", description: "Log your mood 14 times.", category: "consistency", stat: "moodLogTotal", goal: 14, unit: "logs" },

  // Sleep
  { id: "full-night", title: "Full Night", description: "Sleep 8 hours in a night.", category: "sleep", stat: "nights8h", goal: 1, unit: "nights" },
  { id: "well-rested", title: "Well Rested", description: "Get 7 nights of 8h+ sleep.", category: "sleep", stat: "nights8h", goal: 7, unit: "nights" },
  { id: "sleep-champion", title: "Sleep Champion", description: "Get 30 nights of 8h+ sleep.", category: "sleep", stat: "nights8h", goal: 30, unit: "nights" },
  { id: "debt-free", title: "Debt Free", description: "Clear your weekly sleep debt.", category: "sleep", stat: "sleepDebtCleared", goal: 1 },

  // Recovery
  { id: "peak-day", title: "Peak Day", description: "Reach 85+ readiness.", category: "recovery", stat: "optimalDays", goal: 1, unit: "days" },
  { id: "peak-week", title: "Peak Week", description: "Reach 85+ readiness on 7 days.", category: "recovery", stat: "optimalDays", goal: 7, unit: "days" },
  { id: "steady-recovery", title: "Steady", description: "Hold 70+ readiness 7 days running.", category: "recovery", stat: "readiness70Streak", goal: 7, unit: "days" },

  // Activity
  { id: "first-workout", title: "First Rep", description: "Log your first workout.", category: "activity", stat: "workoutTotal", goal: 1 },
  { id: "consistent-mover", title: "Consistent Mover", description: "Work out on 10 different days.", category: "activity", stat: "workoutDays", goal: 10, unit: "days" },
  { id: "step-goal", title: "10K Steps", description: "Hit 10,000 steps in a day.", category: "activity", stat: "stepDaysOver10k", goal: 1, unit: "days" },
  { id: "step-streak", title: "On Your Feet", description: "Hit 10K steps on 10 days.", category: "activity", stat: "stepDaysOver10k", goal: 10, unit: "days" },

  // Engagement
  { id: "first-briefing", title: "Briefed", description: "Generate your first daily briefing.", category: "engagement", stat: "briefingsTotal", goal: 1 },
  { id: "well-briefed", title: "Well Briefed", description: "Build up 30 daily briefings.", category: "engagement", stat: "briefingsTotal", goal: 30, unit: "briefings" },

  // Personal bests
  { id: "hrv-high", title: "Strong Heart", description: "Reach an HRV of 60 ms.", category: "milestone", stat: "bestHrv", goal: 60, unit: "ms" },
  { id: "readiness-ace", title: "Readiness Ace", description: "Reach 90 readiness.", category: "milestone", stat: "bestReadiness", goal: 90 },
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
