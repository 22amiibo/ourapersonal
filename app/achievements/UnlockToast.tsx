"use client";

import { useEffect, useState } from "react";
import { TIER_LABEL, TIER_TOKEN, type Tier } from "@/lib/achievements";

export type UnlockedAward = { id: string; title: string; tier?: Tier };

// A subtle, one-at-a-time slide-up for awards earned on this very load. The
// server decides what's "newly earned" (rows freshly inserted into
// achievement_unlocks) and passes them in; we just sequence the reveal. No
// confetti — a quiet badge that fits Circadian Glass.
export default function UnlockToast({ awards }: { awards: UnlockedAward[] }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(awards.length > 0);

  useEffect(() => {
    if (awards.length === 0) return;
    const hold = setTimeout(() => {
      if (index + 1 < awards.length) {
        setIndex((i) => i + 1);
      } else {
        setShown(false);
      }
    }, 3200);
    return () => clearTimeout(hold);
  }, [index, awards.length]);

  if (!shown || awards.length === 0) return null;
  const a = awards[index];
  const metal = a.tier ? TIER_TOKEN[a.tier] : "var(--color-accent)";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div
        key={a.id}
        className="animate-slide-up flex items-center gap-3 rounded-pill px-4 py-3 glass-2"
        style={{ boxShadow: `0 0 22px -6px color-mix(in oklch, ${metal} 60%, transparent)` }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklch, ${metal} 20%, transparent)` }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M8.4 13.2 6.8 22l5.2-3 5.2 3-1.6-8.8" fill={metal} fillOpacity="0.22" stroke={metal} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="12" cy="8" r="6.2" fill={metal} fillOpacity="0.18" stroke={metal} strokeWidth="1.5" />
            <path d="M12 4.9l1.06 2.15 2.37.34-1.72 1.67.41 2.36L12 10.96l-2.12 1.1.41-2.36L8.57 7.4l2.37-.35z" fill={metal} />
          </svg>
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: metal }}>
            {a.tier ? `${TIER_LABEL[a.tier]} unlocked` : "Award unlocked"}
          </p>
          <p className="text-[14px] font-semibold text-ink">{a.title}</p>
        </div>
      </div>
    </div>
  );
}
