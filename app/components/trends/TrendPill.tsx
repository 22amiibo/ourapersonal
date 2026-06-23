// Hairline-bordered pill: label left, value right (e.g. "Trend" · "+8 vs prior").
export default function TrendPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-pill px-4 py-2.5"
      style={{ border: "0.5px solid var(--color-line-strong)" }}
    >
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}
