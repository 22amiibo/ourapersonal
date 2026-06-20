"use client";

import { useState } from "react";

type Props = {
  data: number[];
  labels: string[];
  min?: number;
  max?: number;
};

const W = 320;
const H = 100;
const PAD = { top: 18, right: 8, bottom: 22, left: 8 };

export default function TrendChart({ data, labels, min, max }: Props) {
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null);

  if (data.length < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMin = min ?? Math.min(...data) - 5;
  const yMax = max ?? Math.max(...data) + 5;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-hidden="true"
        onPointerLeave={() => setTooltip(null)}
      >
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(v)}
            r="6"
            fill="transparent"
            onPointerEnter={(e) => {
              e.currentTarget.setAttribute("r", "5");
              setTooltip({ index: i, x: xAt(i), y: yAt(v) });
            }}
            onPointerLeave={() => setTooltip(null)}
            className="cursor-pointer"
          />
        ))}
        {data.map((v, i) => (
          <circle key={`dot-${i}`} cx={xAt(i)} cy={yAt(v)} r="3.5" fill="var(--color-accent)" pointerEvents="none" />
        ))}
        {tooltip && (
          <g pointerEvents="none">
            <rect
              x={Math.min(Math.max(tooltip.x - 22, 2), W - 48)}
              y={tooltip.y - 26}
              width={44}
              height={20}
              rx={6}
              fill="var(--color-surface)"
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={Math.min(Math.max(tooltip.x, 24), W - 24)}
              y={tooltip.y - 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="var(--color-ink)"
              fontFamily="var(--font-mono)"
            >
              {data[tooltip.index]}
            </text>
          </g>
        )}
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
    </div>
  );
}
