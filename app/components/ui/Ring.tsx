import { zoneColor, zoneLabel, zoneFor } from "@/lib/scores";

type RingProps = {
  /** 0–100 score, or null when no data */
  score: number | null | undefined;
  size?: number;
  stroke?: number;
  /** small caption under the number, e.g. "Sleep" */
  label?: string;
};

export default function Ring({ score, size = 132, stroke = 8, label }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const off = c * (1 - pct);

  const zone = zoneFor(score);
  const color = zoneColor[zone];
  const hasData = score != null;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={hasData ? `${label ?? "Score"} ${score}, ${zoneLabel[zone]}` : `${label ?? "Score"} unavailable`}
        style={{ filter: zone === "optimal" ? "drop-shadow(var(--shadow-glow))" : undefined }}
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        {/* value arc */}
        {hasData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={
              {
                "--dash": `${c}px`,
                "--off": `${off}px`,
                strokeDashoffset: `${off}px`,
                animation: "ring-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
              } as React.CSSProperties
            }
          />
        )}
      </svg>

      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-2xl font-medium tabular-nums tracking-tight text-ink">
          {hasData ? score : "—"}
        </span>
        {label && (
          <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-3">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}