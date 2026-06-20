export type CorrelationResult = {
  id: string;
  label: string;
  withFactor: number | null;
  withoutFactor: number | null;
  delta: number | null;
  n: number;
  significant: boolean;
};

export function formatInsight(r: CorrelationResult): string {
  if (!r.significant || r.delta == null) return "";
  const dir = r.delta < 0 ? "lower" : "higher";
  const abs = Math.abs(r.delta);
  const parts = r.label.split(" → ");
  const factor = parts[0];
  const metric = parts[1] ?? r.label;
  return `Your ${metric} averages ${abs.toFixed(1)} pts ${dir} on nights after ${factor} (${r.n} nights of data).`;
}
