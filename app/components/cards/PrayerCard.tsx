"use client";

import { useState } from "react";
import GlassCard from "../ui/GlassCard";

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200"
      style={{
        background: checked ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
        border: checked ? "none" : "1px solid rgba(255,255,255,0.20)",
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export default function PrayerCard() {
  const [checked, setChecked] = useState<boolean[]>(Array(PRAYERS.length).fill(false));
  const count = checked.filter(Boolean).length;

  const toggle = (i: number) =>
    setChecked((c) => c.map((v, j) => (j === i ? !v : v)));

  const badge = (
    <div
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: "var(--color-accent)" }}
    >
      {count}/{PRAYERS.length}
    </div>
  );

  return (
    <GlassCard title="PRAYERS" badge={badge}>
      <ul className="space-y-3">
        {PRAYERS.map((name, i) => (
          <li key={name}>
            <button
              className="flex w-full items-center gap-3 transition-transform active:scale-[0.98]"
              onClick={() => toggle(i)}
            >
              <CheckCircle checked={checked[i]} />
              <span className="text-[14px] font-normal text-white">{name}</span>
            </button>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
