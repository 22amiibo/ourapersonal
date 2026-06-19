"use client";

type Props = {
  data: number[];
  labels: string[];
  min?: number;
  max?: number;
};

const W = 320;
const H = 100;
const PAD = { top: 14, right: 8, bottom: 22, left: 8 };

export default function TrendChart({ data, labels, min, max }: Props) {
  if (data.length < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const yMin = min ?? Math.min(...data) - 5;
  const yMax = max ?? Math.max(...data) + 5;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) =>
    PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill="var(--color-accent)" />
      ))}
      {data.map((v, i) => (
        <text
          key={`val-${i}`}
          x={xAt(i)}
          y={yAt(v) - 7}
          textAnchor="middle"
          fontSize="8"
          fill="var(--color-ink-3)"
          fontFamily="var(--font-mono)"
        >
          {v}
        </text>
      ))}
      {labels.map((l, i) => (
        <text
          key={`lbl-${i}`}
          x={xAt(i)}
          y={H - 4}
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          fontSize="9"
          fill="var(--color-ink-3)"
          fontFamily="var(--font-mono)"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}
