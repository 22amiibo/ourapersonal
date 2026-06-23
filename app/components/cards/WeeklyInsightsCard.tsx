import GlassCard from "../ui/GlassCard";

const HEIGHTS = [
  35, 45, 30, 55, 40, 65, 50, 75, 60, 85, 70, 80, 65, 55, 45, 70, 60, 75,
  55, 65, 50, 75, 60, 55, 45, 70, 60, 75, 55, 65, 50, 75, 60, 85, 70, 55,
  45, 70, 60, 75, 55, 65, 50, 75, 60, 55, 45, 70, 60, 75, 55, 65, 50, 75,
  60, 55, 45, 70, 60, 75,
];

const FILLED = 24;

export function BarChart() {
  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: 60, display: "flex", alignItems: "flex-end", gap: 2 }}
      aria-hidden
    >
      {HEIGHTS.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h,
            flexShrink: 0,
            borderRadius: 2,
            background: i < FILLED ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </div>
  );
}

export default function WeeklyInsightsCard() {
  return (
    <GlassCard title="WEEKLY INSIGHTS">
      <BarChart />
      <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
        Last 60 days · first 24 logged
      </p>
    </GlassCard>
  );
}
