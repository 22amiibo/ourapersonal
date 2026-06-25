import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWellness, gradeFromScore } from "./scores";

test("computeWellness blends the three pillars with 35/35/30 weights", () => {
  const w = computeWellness({ sleep: 80, readiness: 80, activity: 80 });
  assert.equal(w?.score, 80);
  assert.equal(w?.pillars.length, 3);
});

test("computeWellness renormalizes weights when a pillar is missing", () => {
  // sleep 90 / readiness 70, no activity → (0.35*90 + 0.35*70) / 0.70 = 80
  const w = computeWellness({ sleep: 90, readiness: 70, activity: null });
  assert.equal(w?.score, 80);
  assert.equal(w?.pillars.length, 2);
});

test("computeWellness returns null with fewer than two pillars", () => {
  assert.equal(computeWellness({ sleep: 80, readiness: null, activity: null }), null);
  assert.equal(computeWellness({ sleep: null, readiness: null, activity: null }), null);
});

test("computeWellness exposes each pillar's value and weight for explainability", () => {
  const w = computeWellness({ sleep: 82, readiness: 75, activity: 60 });
  const sleep = w?.pillars.find((p) => p.key === "sleep");
  assert.equal(sleep?.value, 82);
  assert.equal(sleep?.weight, 0.35);
});

test("gradeFromScore stays the single grade source", () => {
  assert.equal(gradeFromScore(91).letter, "A+");
  assert.equal(gradeFromScore(null).letter, "—");
});
