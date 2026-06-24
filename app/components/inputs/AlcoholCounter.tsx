"use client";

import { useState } from "react";

function StepBtn({ label, onClick }: { label: "−" | "+"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === "−" ? "Decrease" : "Increase"}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[24px] font-medium leading-none transition-transform active:scale-90"
      style={{
        background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
        border: "0.5px solid color-mix(in oklch, var(--color-accent) 50%, transparent)",
        color: "var(--color-accent)",
      }}
    >
      {label}
    </button>
  );
}

// Alcohol counter — simple drink tally. Confirm writes an `alcohol` row.
export default function AlcoholCounter({
  initial = 1,
  busy = false,
  onConfirm,
}: {
  initial?: number;
  busy?: boolean;
  onConfirm: (drinks: number) => void;
}) {
  const [n, setN] = useState(Math.max(0, initial));

  return (
    <div className="rounded-card glass-1 p-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
        Alcohol
      </span>

      <div className="mt-4 flex items-center justify-center gap-7">
        <StepBtn label="−" onClick={() => setN((v) => Math.max(0, v - 1))} />
        <span
          className="w-16 text-center font-mono text-[44px] font-semibold leading-none tabular-nums"
          style={{ color: n >= 3 ? "var(--color-rose)" : n >= 2 ? "var(--color-amber)" : "var(--color-ink)" }}
        >
          {n}
        </span>
        <StepBtn label="+" onClick={() => setN((v) => v + 1)} />
      </div>

      <button
        type="button"
        onClick={() => onConfirm(n)}
        disabled={busy || n <= 0}
        className="mt-4 min-h-[44px] w-full rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? "Logging…" : `Log ${n} drink${n === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
