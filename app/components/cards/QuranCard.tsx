"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import GlassCard from "../ui/GlassCard";

function StepButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] leading-none text-white transition-transform active:scale-90"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {label}
    </button>
  );
}

export default function QuranCard() {
  const [page, setPage] = useState(0);

  return (
    <GlassCard title="QURAN" icon={<BookOpen size={16} className="text-white" />}>
      <div className="flex items-center justify-between">
        <StepButton label="−" onClick={() => setPage((p) => Math.max(0, p - 1))} />
        <div className="flex items-baseline gap-1">
          <span className="text-[36px] font-semibold tabular-nums leading-none text-white">
            {page}
          </span>
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            pg
          </span>
        </div>
        <StepButton label="+" onClick={() => setPage((p) => p + 1)} />
      </div>
    </GlassCard>
  );
}
