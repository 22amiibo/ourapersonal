import { sql } from "@/lib/db";
import { localDateStr } from "@/lib/dates";
import {
  type FeatureVector,
  computeHealthScore,
  computeFocusScore,
  computeRecoveryScore,
  computeAcademicReadiness,
} from "@/lib/scores";

const STAGE = "feature_vectors";
const SLEEP_TARGET_HOURS = 8;

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getCursor(userId: number, stage: string): Promise<string | null> {
  const rows = await sql`
    SELECT processed_through FROM processing_cursors
    WHERE user_id = ${userId} AND pipeline_stage = ${stage}`;
  const through = rows[0] ? (rows[0] as any).processed_through : null;
  return through ? String(through).slice(0, 10) : null;
}

async function setCursor(userId: number, stage: string, date: string): Promise<void> {
  await sql`
    INSERT INTO processing_cursors (user_id, pipeline_stage, processed_through, last_run, status)
    VALUES (${userId}, ${stage}, ${date}, NOW(), 'idle')
    ON CONFLICT (user_id, pipeline_stage) DO UPDATE
    SET processed_through = EXCLUDED.processed_through, last_run = NOW(),
        status = 'idle', error_message = NULL`;
}

async function markError(userId: number, stage: string, message: string): Promise<void> {
  await sql`
    INSERT INTO processing_cursors (user_id, pipeline_stage, last_run, status, error_count, error_message)
    VALUES (${userId}, ${stage}, NOW(), 'error', 1, ${message})
    ON CONFLICT (user_id, pipeline_stage) DO UPDATE
    SET last_run = NOW(), status = 'error',
        error_count = processing_cursors.error_count + 1,
        error_message = ${message}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return localDateStr("UTC", dt);
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export async function advanceFeatureVectors(userId: number, tz: string): Promise<void> {
  try {
    const yesterday = localDateStr(tz, new Date(Date.now() - 86400000));
    const cursor = await getCursor(userId, STAGE);
    const start = cursor ? addDays(cursor, 1) : addDays(yesterday, -90);
    if (start > yesterday) return;

    const previousByDate = new Map<string, FeatureVector>();

    for (const date of eachDate(start, yesterday)) {
      const ouraRows = await sql`
        SELECT day, readiness_score, hrv_avg, resting_hr, total_sleep_seconds, raw_payload
        FROM oura_daily WHERE user_id = ${userId} AND day = ${date}`;
      if (ouraRows.length === 0) continue;
      const oura = ouraRows[0] as any;
      const payload = oura.raw_payload ?? {};

      const moodRows = await sql`
        SELECT AVG(mood)::numeric AS mood, AVG(energy)::numeric AS energy,
               AVG(stress)::numeric AS stress
        FROM mood_logs WHERE user_id = ${userId} AND log_date = ${date}`;
      const confRows = await sql`
        SELECT AVG(confidence_score)::numeric AS confidence,
               AVG(stress_score)::numeric AS stress
        FROM confidence_logs WHERE user_id = ${userId} AND log_date = ${date}`;
      const intakeRows = await sql`
        SELECT
          COALESCE(SUM(quantity) FILTER (WHERE type = 'caffeine'), 0) AS caffeine_mg,
          COALESCE(SUM(quantity) FILTER (WHERE type = 'alcohol'), 0) AS alcohol_drinks,
          COUNT(*) FILTER (WHERE type = 'workout') AS workout_count
        FROM intake_log
        WHERE user_id = ${userId} AND (timestamp AT TIME ZONE ${tz})::date = ${date}`;

      const mood = moodRows[0] as any;
      const conf = confRows[0] as any;
      const intake = intakeRows[0] as any;

      const sleepHours = oura.total_sleep_seconds != null
        ? Number(oura.total_sleep_seconds) / 3600
        : null;

      const debtRows = await sql`
        SELECT total_sleep_seconds FROM oura_daily
        WHERE user_id = ${userId} AND day <= ${date} AND day > ${addDays(date, -7)}
          AND total_sleep_seconds IS NOT NULL`;
      let sleepDebt7d: number | null = null;
      if (debtRows.length > 0) {
        const totalHours = debtRows.reduce(
          (acc, r) => acc + Number((r as any).total_sleep_seconds) / 3600,
          0,
        );
        const deficit = SLEEP_TARGET_HOURS * debtRows.length - totalHours;
        sleepDebt7d = Math.max(0, deficit) / debtRows.length;
      }

      const readiness = num(oura.readiness_score);
      const hrv = num(oura.hrv_avg);
      const prev = previousByDate.get(addDays(date, -1)) ?? null;
      let prevReadiness = prev?.readiness ?? null;
      let prevHrv = prev?.hrv ?? null;
      if (prev == null) {
        const yRows = await sql`
          SELECT readiness, hrv FROM daily_feature_vectors
          WHERE user_id = ${userId} AND vector_date = ${addDays(date, -1)}`;
        if (yRows.length > 0) {
          prevReadiness = num((yRows[0] as any).readiness);
          prevHrv = num((yRows[0] as any).hrv);
        }
      }

      const vector: FeatureVector = {
        user_id: userId,
        vector_date: date,
        sleep_hours: sleepHours,
        readiness,
        hrv,
        resting_hr: num(oura.resting_hr),
        activity_score: num(payload.activity_score),
        steps: num(payload.steps),
        caffeine_mg: num(intake.caffeine_mg),
        alcohol_drinks: num(intake.alcohol_drinks),
        workout_count: num(intake.workout_count),
        mood_score: num(mood.mood),
        stress_score: num(mood.stress ?? conf.stress),
        confidence_score: num(conf.confidence),
        energy_score: num(mood.energy),
        sleep_debt_7d: sleepDebt7d,
        readiness_delta:
          readiness != null && prevReadiness != null ? readiness - prevReadiness : null,
        hrv_delta: hrv != null && prevHrv != null ? hrv - prevHrv : null,
        health_score: null,
        focus_score: null,
        recovery_score: null,
        academic_readiness: null,
      };

      vector.health_score = computeHealthScore(vector);
      vector.focus_score = computeFocusScore(vector);
      vector.recovery_score = computeRecoveryScore(vector);
      vector.academic_readiness = computeAcademicReadiness(vector);

      await sql`
        INSERT INTO daily_feature_vectors (
          user_id, vector_date, sleep_hours, readiness, hrv, resting_hr,
          activity_score, steps, caffeine_mg, alcohol_drinks, workout_count,
          mood_score, stress_score, confidence_score, energy_score,
          sleep_debt_7d, readiness_delta, hrv_delta,
          health_score, focus_score, recovery_score, academic_readiness
        ) VALUES (
          ${userId}, ${date}, ${vector.sleep_hours}, ${vector.readiness}, ${vector.hrv},
          ${vector.resting_hr}, ${vector.activity_score}, ${vector.steps},
          ${vector.caffeine_mg}, ${vector.alcohol_drinks}, ${vector.workout_count},
          ${vector.mood_score}, ${vector.stress_score}, ${vector.confidence_score},
          ${vector.energy_score}, ${vector.sleep_debt_7d}, ${vector.readiness_delta},
          ${vector.hrv_delta}, ${vector.health_score}, ${vector.focus_score},
          ${vector.recovery_score}, ${vector.academic_readiness}
        )
        ON CONFLICT (user_id, vector_date) DO UPDATE SET
          sleep_hours = EXCLUDED.sleep_hours,
          readiness = EXCLUDED.readiness,
          hrv = EXCLUDED.hrv,
          resting_hr = EXCLUDED.resting_hr,
          activity_score = EXCLUDED.activity_score,
          steps = EXCLUDED.steps,
          caffeine_mg = EXCLUDED.caffeine_mg,
          alcohol_drinks = EXCLUDED.alcohol_drinks,
          workout_count = EXCLUDED.workout_count,
          mood_score = EXCLUDED.mood_score,
          stress_score = EXCLUDED.stress_score,
          confidence_score = EXCLUDED.confidence_score,
          energy_score = EXCLUDED.energy_score,
          sleep_debt_7d = EXCLUDED.sleep_debt_7d,
          readiness_delta = EXCLUDED.readiness_delta,
          hrv_delta = EXCLUDED.hrv_delta,
          health_score = EXCLUDED.health_score,
          focus_score = EXCLUDED.focus_score,
          recovery_score = EXCLUDED.recovery_score,
          academic_readiness = EXCLUDED.academic_readiness`;

      previousByDate.set(date, vector);
    }

    await setCursor(userId, STAGE, yesterday);
  } catch (err) {
    await markError(userId, STAGE, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
