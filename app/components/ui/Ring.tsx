import { zoneColor, zoneLabel, zoneFor } from "@/lib/scores";

type RingProps = {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
  // The user's recent normal (e.g. 14-day average). Drawn as a faint thinner
  // "ghost" arc under the live arc so "today vs typical" reads at a glance.
  baseline?: number | null;
};

export default function Ring({ score, size = 132, stroke = 9, label, color, baseline }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const off = c * (1 - pct);

  const baselinePct =
    baseline == null || !Number.isFinite(baseline) ? null : Math.max(0, Math.min(100, baseline)) / 100;
  const baselineOff = baselinePct == null ? null : c * (1 - baselinePct);
  const ghostStroke = Math.max(2, stroke * 0.5);

  const zone = zoneFor(score);
  const arcColor = color ?? zoneColor[zone];
  const hasData = score != null;
  const isOptimal = zone === "optimal";
  const glowVar = color === "var(--color-accent-blue)"
    ? "var(--shadow-glow-blue)"
    : color === "var(--color-amber)"
    ? "var(--shadow-glow-amber)"
    : "var(--shadow-glow)";
  // Charge-up glow color tracks the arc color.
  const arcGlow = color === "var(--color-accent-blue)"
    ? "rgba(94,150,247,.55)"
    : color === "var(--color-amber)"
    ? "rgba(245,158,11,.5)"
    : "rgba(20,184,166,.55)";

  const fontSize = size >= 110 ? "1.75rem" : size >= 84 ? "1.5rem" : "1.25rem";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          hasData
            ? `${label ?? "Score"} ${score}, ${zoneLabel[zone]}`
            : `${label ?? "Score"} unavailable`
        }
        style={isOptimal ? { filter: `drop-shadow(${glowVar})` } : undefined}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth={stroke}
        />
        {/* Baseline ghost arc — "your normal", faint + thin, beneath the value. */}
        {baselineOff != null && hasData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={arcColor}
            strokeOpacity={0.3}
            strokeWidth={ghostStroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={baselineOff}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        {/* Value arc */}
        {hasData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={
              {
                "--dash": `${c}px`,
                "--off": `${off}px`,
                "--arc-glow": arcGlow,
                strokeDashoffset: `${off}px`,
                animation:
                  "ring-draw 1s cubic-bezier(0.22, 1, 0.36, 1) both, ring-charge 1.15s ease-out both",
              } as React.CSSProperties
            }
          />
        )}
      </svg>

      <div className="absolute flex flex-col items-center gap-0.5">
        <span
          className="font-mono font-semibold tabular-nums tracking-tight text-ink"
          style={{ fontSize, lineHeight: 1 }}
        >
          {hasData ? score : "—"}
        </span>
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-3">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
