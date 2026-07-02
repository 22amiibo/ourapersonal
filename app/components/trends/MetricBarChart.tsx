// Bar chart for Trends — thin bars, optional teal average line, optional right
// value axis + horizontal gridlines, single-letter/day labels. Pure SVG, no AI.
// (Distinct from ui/TrendChart, which is a scrubbable line chart — kept as-is.)

type Props = {
  values: (number | null)[];
  labels: string[]; // same length; "" renders no label for that bar
  average?: number | null;
  accent?: boolean; // bars teal (detail) vs muted gray (highlight mini)
  height?: number;
  showAxis?: boolean; // right-side value labels + horizontal gridlines
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * pow;
}

const fmtAxis = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

export default function MetricBarChart({
  values,
  labels,
  average = null,
  accent = false,
  height = 140,
  showAxis = false,
}: Props) {
  const W = 320;
  const H = height;
  const hasLabels = labels.some(Boolean);
  const PAD = {
    top: 10,
    right: showAxis ? 30 : 6,
    bottom: hasLabels ? 20 : 6,
    left: 6,
  };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const nums = values.filter((v): v is number => v != null);
  const peak = Math.max(...nums, average ?? 0, 1);
  const yMax = niceMax(peak);
  const baseline = PAD.top + innerH;
  const yAt = (v: number) => baseline - (v / yMax) * innerH;

  const n = values.length || 1;
  const slot = innerW / n;
  const barW = Math.max(2, slot * 0.5);
  const xAt = (i: number) => PAD.left + slot * i + slot / 2;

  // Muted bars read from ink so they stay visible in light mode too.
  const barColor = accent ? "var(--color-accent)" : "color-mix(in oklch, var(--color-ink) 20%, transparent)";
  const gridFracs = showAxis ? [0, 0.5, 1] : [];

  // Footprint-preserving empty state: no numeric values → keep the exact chart
  // height but show a friendly note + a faint baseline instead of a blank grid,
  // so switching to a sparse range never collapses the layout.
  if (nums.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="No data in this range">
        <line x1={PAD.left} y1={baseline} x2={W - PAD.right} y2={baseline} stroke="var(--color-line)" strokeWidth="1" />
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)" fontFamily="var(--font-sans)">
          No data in this range
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
      {/* Horizontal gridlines + right-axis labels */}
      {gridFracs.map((f) => {
        const y = baseline - f * innerH;
        return (
          <g key={`grid-${f}`}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--color-line)" strokeWidth="1" />
            <text x={W - PAD.right + 4} y={y + 3} fontSize="8" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
              {fmtAxis(yMax * f)}
            </text>
          </g>
        );
      })}

      {/* Vertical dashed gridlines between bars (detail only) */}
      {showAxis &&
        values.map((_, i) => (
          <line
            key={`vg-${i}`}
            x1={PAD.left + slot * i}
            y1={PAD.top}
            x2={PAD.left + slot * i}
            y2={baseline}
            stroke="var(--color-line)"
            strokeWidth="0.5"
            strokeDasharray="2 3"
            opacity="0.6"
          />
        ))}

      {/* Bars — draw up from the baseline on reveal (reduced-motion neutralizes) */}
      {values.map((v, i) =>
        v == null ? null : (
          <rect
            key={`bar-${i}`}
            className="chart-bar-draw"
            style={{ animationDelay: `${Math.min(i * 8, 240)}ms` }}
            x={xAt(i) - barW / 2}
            y={yAt(v)}
            width={barW}
            height={Math.max(0, baseline - yAt(v))}
            rx={Math.min(2, barW / 2)}
            fill={barColor}
          />
        ),
      )}

      {/* Average line (teal) */}
      {average != null && (
        <line
          x1={PAD.left}
          y1={yAt(average)}
          x2={W - PAD.right}
          y2={yAt(average)}
          stroke="var(--color-accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      )}

      {/* Day / date labels */}
      {labels.map((l, i) =>
        l ? (
          <text
            key={`lbl-${i}`}
            x={xAt(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-ink-3)"
            fontFamily="var(--font-mono)"
          >
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}
