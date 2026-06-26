"use client";

import { useState } from "react";

// Caffeine slider — snaps to `step` mg (default 25: 0, 25, 50 …). Confirm writes
// a `caffeine` row via the parent's onConfirm. accentColor tints track+thumb teal.
export default function CaffeineSlider({
  step = 25,
  max = 600,
  initial = 100,
  busy = false,
  bare = false,
  onConfirm,
}: {
  step?: number;
  max?: number;
  initial?: number;
  busy?: boolean;
  bare?: boolean;
  onConfirm: (mg: number) => void;
}) {
  const [mg, setMg] = useState(Math.min(max, Math.round(initial / step) * step));

  const body = (
    <>
      <div className={`${bare ? "" : "mt-3 "}flex items-end gap-1.5`}>
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

      <button
        type="button"
        onClick={() => onConfirm(mg)}
        disabled={busy || mg <= 0}
        className="mt-4 min-h-[44px] w-full rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? "Logging…" : `Log ${mg} mg`}
      </button>
    </>
  );

  if (bare) return <div className="px-5 pb-5 pt-4">{body}</div>;
  return (
    <div className="rounded-card glass-1 p-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Caffeine</span>
      {body}
    </div>
  );
}
