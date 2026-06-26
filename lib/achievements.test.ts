import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  currentDayStreak,
  type AchievementStats,
} from "./achievements";

const ZERO: AchievementStats = {
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

test("the catalog has at least 50 achievements", () => {
  assert.ok(ACHIEVEMENTS.length >= 50, `expected ≥50, got ${ACHIEVEMENTS.length}`);
});

test("every catalog entry has a unique id and a positive goal", () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.goal > 0, `${a.id} goal must be > 0`);
});

test("tiers are in 1–5 when present", () => {
  for (const a of ACHIEVEMENTS) {
    if (a.tier !== undefined) {
      assert.ok(a.tier >= 1 && a.tier <= 5, `${a.id} tier out of range: ${a.tier}`);
    }
  }
});

test("each family's tiers ascend by goal in catalog order", () => {
  const byFamily = new Map<string, number[]>();
  for (const a of ACHIEVEMENTS) {
    if (!a.family) continue;
    const arr = byFamily.get(a.family) ?? [];
    arr.push(a.goal);
    byFamily.set(a.family, arr);
  }
  for (const [family, goals] of byFamily) {
    assert.ok(goals.length >= 2, `family ${family} should have ≥2 tiers`);
    for (let i = 1; i < goals.length; i++) {
      assert.ok(goals[i] > goals[i - 1], `family ${family} goals must strictly ascend`);
    }
  }
});

test("nothing is unlocked from all-zero stats", () => {
  const out = evaluateAchievements(ZERO);
  assert.equal(out.every((a) => !a.unlocked), true);
  assert.equal(out.every((a) => a.pct === 0), true);
});

test("unlocks at the goal and clamps progress + pct", () => {
  const out = evaluateAchievements({ ...ZERO, nights8h: 9 });
  const t1 = out.find((a) => a.id === "nights8h-1")!; // goal 1
  const t7 = out.find((a) => a.id === "nights8h-7")!; // goal 7
  const t30 = out.find((a) => a.id === "nights8h-30")!; // goal 30
  assert.equal(t1.unlocked, true);
  assert.equal(t7.unlocked, true);
  assert.equal(t30.unlocked, false);
  assert.equal(t30.progress, 9); // capped below goal
  assert.equal(t30.current, 9);
  assert.ok(t30.pct > 0.29 && t30.pct < 0.31);
  assert.equal(t7.pct, 1); // clamped at 1
});

test("bestSteps drives the step ladder monotonically", () => {
  const out = evaluateAchievements({ ...ZERO, bestSteps: 12000 });
  assert.equal(out.find((a) => a.id === "steps-10k")!.unlocked, true);
  assert.equal(out.find((a) => a.id === "steps-15k")!.unlocked, false);
  assert.equal(out.find((a) => a.id === "hidden-marathoner")!.unlocked, false);
});

test("currentDayStreak counts back from today", () => {
  const days = ["2026-06-25", "2026-06-24", "2026-06-23", "2026-06-21"];
  assert.equal(currentDayStreak(days, "2026-06-25"), 3); // 25,24,23 then gap at 22
});

test("currentDayStreak allows yesterday as grace when today not yet logged", () => {
  const days = ["2026-06-24", "2026-06-23"];
  assert.equal(currentDayStreak(days, "2026-06-25"), 2);
});

test("currentDayStreak is 0 when the most recent day is older than yesterday", () => {
  const days = ["2026-06-22", "2026-06-21"];
  assert.equal(currentDayStreak(days, "2026-06-25"), 0);
});
