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
  briefingsTotal: 0,
  bestHrv: 0,
  bestReadiness: 0,
};

test("every catalog entry has a unique id and a positive goal", () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.goal > 0, `${a.id} goal must be > 0`);
});

test("nothing is unlocked from all-zero stats", () => {
  const out = evaluateAchievements(ZERO);
  assert.equal(out.every((a) => !a.unlocked), true);
  assert.equal(out.every((a) => a.pct === 0), true);
});

test("unlocks at the goal and clamps progress + pct", () => {
  const out = evaluateAchievements({ ...ZERO, nights8h: 9 });
  const fullNight = out.find((a) => a.id === "full-night")!; // goal 1
  const wellRested = out.find((a) => a.id === "well-rested")!; // goal 7
  const champion = out.find((a) => a.id === "sleep-champion")!; // goal 30
  assert.equal(fullNight.unlocked, true);
  assert.equal(wellRested.unlocked, true);
  assert.equal(champion.unlocked, false);
  assert.equal(champion.progress, 9); // capped below goal
  assert.equal(champion.current, 9);
  assert.ok(champion.pct > 0.29 && champion.pct < 0.31);
  assert.equal(wellRested.pct, 1); // clamped at 1
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
