// Hairline-bordered pill: label left, value right (e.g. "Trend" · "+8 vs prior").
// `valueColor` (optional) tints the value by metric-aware sentiment; defaults
// to neutral ink so callers that don't pass it are unchanged.
export default function TrendPill({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-pill px-4 py-2.5"
      style={{ border: "0.5px solid var(--color-line-strong)" }}
    >
      <span className="text-[13px] text-ink-2">{label}</span>
      <span
        className="font-mono text-[13px] font-semibold tabular-nums text-ink"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
