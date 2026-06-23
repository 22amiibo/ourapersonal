"use client";

import { useState } from "react";
import GlassCard from "../ui/GlassCard";

function StepBtn({
  label,
  onClick,
}: {
  label: "−" | "+";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] leading-none text-white transition-[transform,background] duration-150 active:scale-[0.92]"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in oklch, var(--color-accent) 30%, transparent)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
      }}
      onTouchStart={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in oklch, var(--color-accent) 30%, transparent)";
      }}
      onTouchEnd={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
      }}
    >
      {label}
    </button>
  );
}

function Counter({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 py-1">
      <span
        className="text-[11px] font-medium leading-none"
        style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
      >
        {label}
      </span>
      <span className="text-[28px] font-bold leading-none tabular-nums text-white">
        {value}
      </span>
      <div className="flex items-center gap-3">
        <StepBtn label="−" onClick={onDecrement} />
        <StepBtn label="+" onClick={onIncrement} />
      </div>
    </div>
  );
}

export default function CounterRow() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  return (
    <GlassCard>
      <div className="flex items-stretch">
        <Counter
          label="ALHAMDULLILAH"
          value={a}
          onDecrement={() => setA((v) => Math.max(0, v - 1))}
          onIncrement={() => setA((v) => v + 1)}
        />
        <div
          className="mx-2 self-stretch"
          style={{ width: 1, background: "rgba(255,255,255,0.08)" }}
          aria-hidden
        />
        <Counter
          label="ASTAGHFIRULLAH"
          value={b}
          onDecrement={() => setB((v) => Math.max(0, v - 1))}
          onIncrement={() => setB((v) => v + 1)}
        />
      </div>
    </GlassCard>
  );
}
