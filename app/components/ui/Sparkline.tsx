type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
};

export default function Sparkline({
  values,
  width = 220,
  height = 48,
  color = "var(--color-accent)",
}: SparklineProps) {
  if (values.length < 2) {
    return <div className="h-12 text-xs text-ink-3">Not enough data yet.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pts[0][0]},${height} ${line} ${pts[pts.length - 1][0]},${height}`;
  const [lx, ly] = pts[pts.length - 1];
  const id = `spark-${width}-${values.length}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.75" fill={color} />
    </svg>
  );
}