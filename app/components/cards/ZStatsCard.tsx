"use client";

import { BarChart2 } from "lucide-react";
import SolidCard from "../ui/SolidCard";

const SIZE = 100;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function ProgressRing({ pct }: { pct: number }) {
  const offset = CIRC * (1 - pct / 100);
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={STROKE}
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontSize={22}
        fontWeight={700}
        fontFamily="Inter, sans-serif"
      >
        {pct}%
      </text>
    </svg>
  );
}

export default function ZStatsCard({
  completed = 0,
  total = 11,
}: {
  completed?: number;
  total?: number;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <SolidCard>
      <div className="flex items-center gap-2">
        <BarChart2 size={16} className="text-white" style={{ opacity: 0.5 }} />
        <span
          className="text-[13px] font-semibold text-white"
          style={{ letterSpacing: "0.08em" }}
        >
          ZSTATS
        </span>
      </div>

      <div className="mt-5 flex flex-col items-center gap-2">
        <ProgressRing pct={pct} />
        <p className="text-[13px] font-normal" style={{ color: "var(--text-muted)" }}>
          {completed} / {total} completed
        </p>
      </div>

      <div className="mt-5 text-center">
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--color-accent)", letterSpacing: "0.12em" }}
        >
          TAP FOR MORE
        </span>
      </div>
    </SolidCard>
  );
}
