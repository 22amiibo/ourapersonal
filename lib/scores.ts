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