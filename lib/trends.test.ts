import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeTrend, metricSpec, rangeDays, type TrendPoint } from "./trends";

// Helper: build dated points from a list of values.
const pts = (vals: (number | null)[]): TrendPoint[] =>
  vals.map((v, i) => ({ date: `2026-06-${String(i + 1).padStart(2, "0")}`, value: v }));

test("average, prevAverage and delta are computed over the windows", () => {
  const r = summarizeTrend(
    "readiness",
    "W",
    pts([80, 80, 80, 80, 80, 80, 80]),
    pts([70, 70, 70, 70, 70, 70, 70]),
    "",
  );
  assert.equal(r.average, 80);
  assert.equal(r.prevAverage, 70);
  assert.equal(r.delta, 10);
  assert.equal(r.direction, "up");
});

test("direction is down when the window drops below baseline", () => {
  const r = summarizeTrend("hrv", "W", pts([60]), pts([90]), "ms");
  assert.equal(r.direction, "down");
  assert.equal(r.delta, -30);
});

test("direction snaps to flat within the flat band", () => {
  const r = summarizeTrend("hrv", "W", pts([100]), pts([100]), "ms");
  assert.equal(r.direction, "flat");
  assert.equal(r.delta, 0);
});

test("daysAbove / daysBelow compare each window point to the baseline average", () => {
  // baseline average = 50; window: 60>50, 70>50 (above), 40<50 (below), 50==50 (neither)
  const r = summarizeTrend("steps", "W", pts([60, 70, 40, 50]), pts([50, 50]), "");
  assert.equal(r.daysAbove, 2);
  assert.equal(r.daysBelow, 1);
});

test("null points (missing days) are excluded from the average", () => {
  const r = summarizeTrend("sleep_score", "W", pts([80, null, 80]), pts([70]), "");
  assert.equal(r.average, 80);
  assert.equal(r.prevAverage, 70);
});

test("empty windows average to zero without throwing", () => {
  const r = summarizeTrend("readiness", "W", pts([]), pts([]), "");
  assert.equal(r.average, 0);
  assert.equal(r.prevAverage, 0);
  assert.equal(r.direction, "flat");
});

test("sleep_hours pick converts seconds to hours", () => {
  const spec = metricSpec("sleep_hours");
  assert.equal(spec.pick({ total_sleep_seconds: 27000 } as never), 7.5);
  assert.equal(spec.unit, "h");
});

test("steps pick reads the jsonb-extracted string as a number", () => {
  const spec = metricSpec("steps");
  assert.equal(spec.pick({ steps: "8421" } as never), 8421);
});

test("resting_hr is flagged lower-is-better", () => {
  assert.equal(metricSpec("resting_hr").higherIsBetter, false);
});

test("rangeDays maps D/W/M to 14/7/30", () => {
  assert.equal(rangeDays("D"), 14);
  assert.equal(rangeDays("W"), 7);
  assert.equal(rangeDays("M"), 30);
});

test("unknown metric and range throw", () => {
  assert.throws(() => metricSpec("bogus" as never));
  assert.throws(() => rangeDays("X" as never));
});
