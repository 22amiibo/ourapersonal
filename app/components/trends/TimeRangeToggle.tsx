"use client";

import type { TrendRange } from "@/lib/trends";

const RANGES: { value: TrendRange; label: string }[] = [
  { value: "D", label: "D" },
  { value: "W", label: "W" },
  { value: "M", label: "M" },
  { value: "Q", label: "3M" },
];

// Segmented control: dark pill track, selected = lighter elevated pill.
export default function TimeRangeToggle({
  value,
  onChange,
}: {
  value: TrendRange;
  onChange: (r: TrendRange) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-pill p-1"
      role="tablist"
      aria-label="Time range"
      style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.10)" }}
    >
      {RANGES.map((r) => {
        const active = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.value)}
            className="min-h-[34px] flex-1 rounded-pill text-[13px] font-semibold transition-all active:scale-95"
            style={
              active
                ? {
                    background: "rgba(255,255,255,0.16)",
                    color: "var(--color-ink)",
                    boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.3)",
                  }
                : { background: "transparent", color: "var(--color-ink-3)" }
            }
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
