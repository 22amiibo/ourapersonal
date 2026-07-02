"use client";

import { useRef, useState } from "react";

type Props = {
  data: number[];
  labels: string[];
  min?: number;
  max?: number;
  color?: string;
  threshold?: number;
};

const W = 320;
const H = 100;
const PAD = { top: 18, right: 8, bottom: 22, left: 8 };

export default function TrendChart({ data, labels, min, max, color = "var(--color-accent)", threshold }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  if (data.length < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMin = min ?? Math.min(...data) - 5;
  const yMax = max ?? Math.max(...data) + 5;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const pts = data.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `M ${pts[0][0].toFixed(1)} ${(PAD.top + innerH).toFixed(1)} ${pts.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L ${pts[pts.length - 1][0].toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;
  const gradId = `tgrd-${data.length}`;

  const thresholdY = threshold != null ? yAt(threshold) : null;

  // Map a client X coordinate to the nearest data index. Works for mouse
  // and touch because it reads from the SVG's rendered box, not pointer type.
  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const xInView = ((clientX - rect.left) / rect.width) * W;
    const frac = (xInView - PAD.left) / innerW;
    const idx = Math.round(frac * (data.length - 1));
    return Math.max(0, Math.min(data.length - 1, idx));
  }

  function onScrub(e: React.PointerEvent<SVGRectElement>) {
    setActive(indexFromClientX(e.clientX));
  }

  const ax = active != null ? pts[active][0] : 0;
  const ay = active != null ? pts[active][1] : 0;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {/* Optional threshold line */}
        {thresholdY != null && (
          <line
            x1={PAD.left}
            y1={thresholdY}
            x2={W - PAD.right}
            y2={thresholdY}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        {/* Line — traces left→right on reveal (reduced-motion neutralizes) */}
        <path d={linePath} pathLength={1} className="chart-line-draw" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots — only at low densities; a 90-day line stays a clean line */}
        {data.length <= 31 &&
          pts.map(([x, y], i) => (
            <circle key={`dot-${i}`} cx={x} cy={y} r="3.5" fill={color} pointerEvents="none" opacity={active != null && active !== i ? 0.35 : 1} />
          ))}
        {/* Active scrubber */}
        {active != null && (
          <g pointerEvents="none">
            <line x1={ax} y1={PAD.top} x2={ax} y2={PAD.top + innerH} stroke={color} strokeWidth="1" strokeOpacity="0.4" />
            <circle cx={ax} cy={ay} r="5" fill={color} />
            <circle cx={ax} cy={ay} r="9" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.35" />
            <rect
              x={Math.min(Math.max(ax - 22, 2), W - 48)}
              y={ay - 28}
              width={44}
              height={20}
              rx={6}
              fill="var(--color-surface)"
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            <text
              x={Math.min(Math.max(ax, 24), W - 24)}
              y={ay - 14}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="var(--color-ink)"
              fontFamily="var(--font-mono)"
            >
              {data[active]}
            </text>
          </g>
        )}
        {/* Labels */}
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
        {/* Full-width scrub surface — captures mouse + touch */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="transparent"
          style={{ touchAction: "none", cursor: "crosshair" }}
          onPointerDown={onScrub}
          onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === "touch") onScrub(e); }}
          onPointerEnter={(e) => { if (e.pointerType !== "touch") onScrub(e); }}
          onPointerLeave={() => setActive(null)}
          onPointerUp={() => setActive(null)}
        />
      </svg>
    </div>
  );
}
