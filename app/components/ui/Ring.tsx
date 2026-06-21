import { zoneColor, zoneLabel, zoneFor } from "@/lib/scores";

type RingProps = {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
};

export default function Ring({ score, size = 132, stroke = 9, label, color }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const off = c * (1 - pct);

  const zone = zoneFor(score);
  const arcColor = color ?? zoneColor[zone];
  const hasData = score != null;
  const isOptimal = zone === "optimal";
  const glowVar = color === "var(--color-accent-blue)"
    ? "var(--shadow-glow-blue)"
    : color === "var(--color-amber)"
    ? "var(--shadow-glow-amber)"
    : "var(--shadow-glow)";

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
                strokeDashoffset: `${off}px`,
                animation: "ring-draw 1s cubic-bezier(0.22, 1, 0.36, 1) both",
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
