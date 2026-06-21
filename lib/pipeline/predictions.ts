import { sql } from "@/lib/db";
import { localDateStr } from "@/lib/dates";

function computeSlope(values: number[]): number | null {
  if (values.length < 3) return null;
  const n = values.length;
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (values[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den < 1e-10 ? null : num / den;
}

function mean(vals: number[]): number {
  return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stddev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

async function predictionExists(
  userId: number,
  type: string,
  targetDate: string,
): Promise<boolean> {
  const rows = (await sql`
    SELECT id FROM prediction_records
    WHERE user_id = ${userId} AND prediction_type = ${type} AND target_date = ${targetDate}
    LIMIT 1
  `) as Array<{ id: number }>;
  return rows.length > 0;
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

// Days from `dateStr` forward to the next Sunday (0 if today is Sunday).
function daysUntilSunday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=Sun
  return dow === 0 ? 0 : 7 - dow;
}

type FvRow = {
  vector_date: string;
  readiness: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_debt_7d: number | null;
};

async function recentVectors(userId: number, limit: number): Promise<FvRow[]> {
  const rows = (await sql`
    SELECT to_char(vector_date, 'YYYY-MM-DD') AS vector_date,
           readiness, hrv, sleep_hours, sleep_debt_7d
    FROM daily_feature_vectors
    WHERE user_id = ${userId}
    ORDER BY vector_date DESC
    LIMIT ${limit}
  `) as FvRow[];
  rows.reverse(); // ascending
  return rows;
}

export async function advancePredictions(userId: number, tz: string): Promise<void> {
  const todayStr = localDateStr(tz);

  // 1. Readiness prediction (tomorrow)
  {
    const target = addDaysStr(todayStr, 1);
    if (!(await predictionExists(userId, "readiness", target))) {
      const rows = await recentVectors(userId, 5);
      const vals = rows.map((r) => r.readiness).filter((v): v is number => v != null).map(Number);
      const debtRow = rows[rows.length - 1];
      const debt = debtRow?.sleep_debt_7d != null ? Number(debtRow.sleep_debt_7d) : 0;
      const slope = computeSlope(vals);
      if (slope != null && slope < -2 && debt > 3) {
        const m = mean(vals);
        const low = m - 10;
        const high = m - 2;
        await sql`
          INSERT INTO prediction_records
            (user_id, prediction_type, prediction, prediction_reasoning, life_area,
             confidence, uncertainty_low, uncertainty_high, target_date, created_at)
          VALUES
            (${userId}, 'readiness',
             ${`Readiness likely to decline tomorrow (~${low.toFixed(0)}-${high.toFixed(0)}).`},
             ${`Readiness has declined ${slope.toFixed(1)} pts/day over 5 days. Sleep debt is ${debt.toFixed(1)}h. Tomorrow's readiness may be lower.`},
             'recovery', 0.65, ${Number(low.toFixed(2))}, ${Number(high.toFixed(2))},
             ${target}, NOW())
        `;
      }
    }
  }

  // 2. Sleep debt end-of-week (next Sunday)
  {
    const daysRemaining = daysUntilSunday(todayStr);
    const target = addDaysStr(todayStr, daysRemaining);
    if (daysRemaining > 0 && !(await predictionExists(userId, "sleep_debt", target))) {
      const rows = await recentVectors(userId, 7);
      const current = rows[rows.length - 1];
      const currentDebt =
        current?.sleep_debt_7d != null ? Number(current.sleep_debt_7d) : null;
      const sleepVals = rows
        .map((r) => r.sleep_hours)
        .filter((v): v is number => v != null)
        .map(Number);
      if (currentDebt != null && sleepVals.length > 0) {
        const avgSleep = mean(sleepVals);
        const projected = currentDebt + daysRemaining * (8 - avgSleep);
        if (projected > 5) {
          await sql`
            INSERT INTO prediction_records
              (user_id, prediction_type, prediction, prediction_reasoning, life_area,
               confidence, uncertainty_low, uncertainty_high, target_date, created_at)
            VALUES
              (${userId}, 'sleep_debt',
               ${`Sleep debt projected to reach ~${projected.toFixed(1)}h by end of week.`},
               ${`At current pace, sleep debt will reach ~${projected.toFixed(1)}h by end of week.`},
               'recovery', 0.70, ${Number((projected - 2).toFixed(2))},
               ${Number((projected + 2).toFixed(2))}, ${target}, NOW())
          `;
        }
      }
    }
  }

  // 3. Exam stress (target: exam date)
  {
    const horizon = addDaysStr(todayStr, 7);
    const events = (await sql`
      SELECT course, to_char(event_date, 'YYYY-MM-DD') AS event_date
      FROM academic_events
      WHERE user_id = ${userId}
        AND event_date > ${todayStr}::date
        AND event_date <= ${horizon}::date
        AND expected_stress >= 7
      ORDER BY event_date ASC
    `) as Array<{ course: string; event_date: string }>;

    if (events.length > 0) {
      const stressRows = await recentVectors(userId, 7);
      const stressVals = (await sql`
        SELECT stress_score
        FROM daily_feature_vectors
        WHERE user_id = ${userId}
        ORDER BY vector_date DESC
        LIMIT 7
      `) as Array<{ stress_score: number | null }>;
      const vals = stressVals
        .map((r) => r.stress_score)
        .filter((v): v is number => v != null)
        .map(Number)
        .reverse();
      const slope = computeSlope(vals);
      const direction = slope == null ? "stable" : slope > 0.2 ? "rising" : slope < -0.2 ? "falling" : "stable";
      void stressRows;

      for (const ev of events) {
        if (await predictionExists(userId, "stress", ev.event_date)) continue;
        const days = Math.round(
          (new Date(ev.event_date + "T00:00:00Z").getTime() -
            new Date(todayStr + "T00:00:00Z").getTime()) /
            86400000,
        );
        await sql`
          INSERT INTO prediction_records
            (user_id, prediction_type, prediction, prediction_reasoning, life_area,
             confidence, target_date, created_at)
          VALUES
            (${userId}, 'stress',
             ${`Elevated stress likely around exam '${ev.course}'.`},
             ${`Exam '${ev.course}' in ${days} days. Stress trend is ${direction}.`},
             'academics', 0.72, ${ev.event_date}, NOW())
        `;
      }
    }
  }

  // 4. HRV decline (tomorrow)
  {
    const target = addDaysStr(todayStr, 1);
    if (!(await predictionExists(userId, "hrv", target))) {
      const last30 = await recentVectors(userId, 30);
      const all = last30.map((r) => r.hrv).filter((v): v is number => v != null).map(Number);
      const last7 = all.slice(-7);
      if (all.length >= 7 && last7.length >= 3) {
        const baseMean = mean(all);
        const baseSd = stddev(all);
        const slope = computeSlope(last7);
        const lastVal = last7[last7.length - 1];
        if (slope != null && slope < 0 && baseSd > 0 && lastVal < baseMean - 1.5 * baseSd) {
          const low = baseMean - 2 * baseSd;
          const high = lastVal;
          await sql`
            INSERT INTO prediction_records
              (user_id, prediction_type, prediction, prediction_reasoning, life_area,
               confidence, uncertainty_low, uncertainty_high, target_date, created_at)
            VALUES
              (${userId}, 'hrv',
               ${`HRV likely to stay suppressed tomorrow.`},
               ${`HRV has trended down (${slope.toFixed(1)}/day over 7 days) and is ${(baseMean - lastVal).toFixed(0)} below baseline.`},
               'recovery', 0.68, ${Number(low.toFixed(2))}, ${Number(high.toFixed(2))},
               ${target}, NOW())
          `;
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Prediction evaluation
// -------------------------------------------------------------

const METRIC_COLUMN: Record<string, { col: string; range: number }> = {
  readiness: { col: "readiness", range: 40 },
  hrv: { col: "hrv", range: 30 },
  sleep_debt: { col: "sleep_debt_7d", range: 14 },
  stress: { col: "stress_score", range: 10 },
};

type PendingPrediction = {
  id: number;
  prediction_type: string;
  uncertainty_low: number | null;
  uncertainty_high: number | null;
  target_date: string;
};

export async function evaluatePredictions(userId: number): Promise<void> {
  const pending = (await sql`
    SELECT id, prediction_type, uncertainty_low, uncertainty_high,
           to_char(target_date, 'YYYY-MM-DD') AS target_date
    FROM prediction_records
    WHERE user_id = ${userId}
      AND target_date < CURRENT_DATE
      AND accuracy IS NULL
  `) as PendingPrediction[];

  for (const p of pending) {
    const spec = METRIC_COLUMN[p.prediction_type];
    if (!spec) continue;
    if (p.uncertainty_low == null || p.uncertainty_high == null) {
      // No numeric interval to score against; mark evaluated with no accuracy.
      await sql`
        UPDATE prediction_records SET evaluated_at = NOW() WHERE id = ${p.id}
      `;
      continue;
    }

    const actualRows = (await sql`
      SELECT ${sql.unsafe(spec.col)} AS val
      FROM daily_feature_vectors
      WHERE user_id = ${userId} AND vector_date = ${p.target_date}::date
      LIMIT 1
    `) as Array<{ val: number | null }>;

    const actual = actualRows[0]?.val;
    if (actual == null) continue;

    const midpoint = (Number(p.uncertainty_low) + Number(p.uncertainty_high)) / 2;
    const accuracy = Math.max(
      0,
      Math.min(1, 1 - Math.abs(midpoint - Number(actual)) / spec.range),
    );

    await sql`
      UPDATE prediction_records
      SET accuracy = ${Number(accuracy.toFixed(3))}, evaluated_at = NOW()
      WHERE id = ${p.id}
    `;
  }

  // Recompute predictive_accuracy_factor per linked insight (if linkage exists).
  await recomputeInsightAccuracyFactors(userId);
}

async function recomputeInsightAccuracyFactors(userId: number): Promise<void> {
  // prediction_records has no insight_id column in the base schema; skip if absent.
  const hasColumn = (await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prediction_records' AND column_name = 'insight_id'
    LIMIT 1
  `) as Array<{ "?column?": number }>;
  if (hasColumn.length === 0) return;

  const grouped = (await sql`
    SELECT insight_id, AVG(accuracy) AS avg_acc
    FROM prediction_records
    WHERE user_id = ${userId} AND insight_id IS NOT NULL AND accuracy IS NOT NULL
    GROUP BY insight_id
  `) as Array<{ insight_id: number; avg_acc: number }>;

  for (const g of grouped) {
    const avg = Number(g.avg_acc);
    const factor = avg >= 0.7 ? 1.0 : avg >= 0.4 ? 0.8 : 0.5;
    await sql`
      UPDATE insights
      SET predictive_accuracy_factor = ${factor}, updated_at = NOW()
      WHERE id = ${g.insight_id} AND user_id = ${userId}
    `;
  }
}
