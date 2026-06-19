type Trend = { value: string; direction: "up" | "down" | "flat" };
const arrow = { up: "↑", down: "↓", flat: "→" } as const;

export default function MetricCard({
  label, trend, center, className = "", children,
}: {
  label: string; trend?: Trend; center?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 shadow-card transition-transform duration-150 active:scale-[0.99] ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</span>
        {trend && (
          <span className="font-mono text-xs tabular-nums text-ink-2">
            <span aria-hidden className="mr-1 text-accent-dim">{arrow[trend.direction]}</span>{trend.value}
          </span>
        )}
      </div>
      <div className={center ? "flex justify-center" : ""}>{children}</div>
    </div>
  );
}