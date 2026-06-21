export type Zone = "optimal" | "good" | "attention" | "low";

export function zoneFor(score: number | null | undefined): Zone {
  if (score == null) return "low";
  if (score >= 85) return "optimal";
  if (score >= 70) return "good";
  if (score >= 60) return "attention";
  return "low";
}

export const zoneColor: Record<Zone, string> = {
  optimal: "var(--color-accent)",
  good: "var(--color-accent-dim)",
  attention: "var(--color-attention)",
  low: "var(--color-low)",
};

export const zoneLabel: Record<Zone, string> = {
  optimal: "Optimal",
  good: "Good",
  attention: "Pay attention",
  low: "Low",
};

export type FeatureVector = {
  user_id: number;
  vector_date: string;
  sleep_hours: number | null;
  readiness: number | null;
  hrv: number | null;
  resting_hr: number | null;
  activity_score: number | null;
  steps: number | null;
  caffeine_mg: number | null;
  alcohol_drinks: number | null;
  workout_count: number | null;
  mood_score: number | null;
  stress_score: number | null;
  confidence_score: number | null;
  energy_score: number | null;
  sleep_debt_7d: number | null;
  readiness_delta: number | null;
  hrv_delta: number | null;
  health_score: number | null;
  focus_score: number | null;
  recovery_score: number | null;
  academic_readiness: number | null;
};

function norm(value: number | null | undefined, min: number, max: number): number | null {
  if (value == null) return null;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function computeHealthScore(v: FeatureVector): number | null {
  const r = norm(v.readiness, 0, 100);
  const s = norm(v.sleep_hours, 0, 10);
  const h = norm(v.hrv, 0, 100);
  const hr = norm(v.resting_hr, 40, 80);
  if (r == null || s == null || h == null || hr == null) return null;
  return (0.35 * r + 0.3 * s + 0.2 * h + 0.15 * (1 - hr)) * 100;
}

export function computeFocusScore(v: FeatureVector): number | null {
  const r = norm(v.readiness, 0, 100);
  const m = norm(v.mood_score, 1, 10);
  const c = norm(v.confidence_score, 1, 10);
  const st = norm(v.stress_score, 1, 10);
  if (r == null || m == null || c == null || st == null) return null;
  return (0.4 * r + 0.3 * m + 0.2 * c + 0.1 * (1 - st)) * 100;
}

export function computeRecoveryScore(v: FeatureVector): number | null {
  const r = norm(v.readiness, 0, 100);
  const h = norm(v.hrv, 0, 100);
  const s = norm(v.sleep_hours, 0, 10);
  const d = norm(v.sleep_debt_7d, 0, 14);
  if (r == null || h == null || s == null || d == null) return null;
  return (0.4 * r + 0.3 * h + 0.2 * s + 0.1 * (1 - d)) * 100;
}

export function computeAcademicReadiness(v: FeatureVector): number | null {
  const focus = computeFocusScore(v);
  const recovery = computeRecoveryScore(v);
  const c = norm(v.confidence_score, 1, 10);
  const st = norm(v.stress_score, 1, 10);
  if (focus == null || recovery == null || c == null || st == null) return null;
  return 0.35 * focus + 0.3 * recovery + (0.25 * c + 0.1 * (1 - st)) * 100;
}