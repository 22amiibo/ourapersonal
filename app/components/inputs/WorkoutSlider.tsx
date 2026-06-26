"use client";

import { useState } from "react";

// Workout duration slider — mirrors CaffeineSlider but snaps to `step` minutes
// (default 15: 15, 30, 45 …). Confirm writes a `workout` row (unit "min").
export default function WorkoutSlider({
  step = 15,
  max = 180,
  initial = 30,
  busy = false,
  bare = false,
  onConfirm,
}: {
  step?: number;
  max?: number;
  initial?: number;
  busy?: boolean;
  bare?: boolean;
  onConfirm: (minutes: number) => void;
}) {
  const [min, setMin] = useState(Math.min(max, Math.max(step, Math.round(initial / step) * step)));

  const body = (
    <>
      <div className={`${bare ? "" : "mt-3 "}flex items-end gap-1.5`}>
        <span className="font-mono text-[40px] font-semibold leading-none tabular-nums text-ink">
          {min}
        </span>
        <span className="mb-1 text-[14px] text-ink-3">min</span>
      </div>

      <input
        type="range"
        min={step}
        max={max}
        step={step}
        value={min}
        onChange={(e) => setMin(Number(e.target.value))}
        aria-label="Workout duration in minutes"
        className="mt-4 h-2 w-full cursor-pointer"
        style={{ accentColor: "var(--color-accent)" }}
      />

      <button
        type="button"
        onClick={() => onConfirm(min)}
        disabled={busy || min <= 0}
        className="mt-4 min-h-[44px] w-full rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? "Logging…" : `Log ${min} min`}
      </button>
    </>
  );

  if (bare) return <div className="px-5 pb-5 pt-4">{body}</div>;
  return (
    <div className="rounded-card glass-1 p-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Workout</span>
      {body}
    </div>
  );
}
