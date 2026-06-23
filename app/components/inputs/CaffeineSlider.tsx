"use client";

import { useState } from "react";

// Caffeine slider — snaps to `step` mg (default 25: 0, 25, 50 …). Confirm writes
// a `caffeine` row via the parent's onConfirm. accentColor tints track+thumb teal.
export default function CaffeineSlider({
  step = 25,
  max = 600,
  initial = 100,
  busy = false,
  onConfirm,
}: {
  step?: number;
  max?: number;
  initial?: number;
  busy?: boolean;
  onConfirm: (mg: number) => void;
}) {
  const [mg, setMg] = useState(Math.min(max, Math.round(initial / step) * step));

  return (
    <div className="rounded-card glass-1 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Caffeine
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink-3">{step} mg steps</span>
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        <span
          className="font-mono text-[40px] font-semibold leading-none tabular-nums"
          style={{ color: mg > 400 ? "var(--color-rose)" : mg > 200 ? "var(--color-amber)" : "var(--color-ink)" }}
        >
          {mg}
        </span>
        <span className="mb-1 text-[14px] text-ink-3">mg</span>
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={mg}
        onChange={(e) => setMg(Number(e.target.value))}
        aria-label="Caffeine amount in milligrams"
        className="mt-4 h-2 w-full cursor-pointer"
        style={{ accentColor: "var(--color-accent)" }}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-3">
        <span>0</span>
        <span>{max / 2}</span>
        <span>{max}</span>
      </div>

      <button
        type="button"
        onClick={() => onConfirm(mg)}
        disabled={busy || mg <= 0}
        className="mt-4 min-h-[44px] w-full rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? "Logging…" : `Log ${mg} mg`}
      </button>
    </div>
  );
}
