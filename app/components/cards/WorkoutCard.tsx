"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import GlassCard from "../ui/GlassCard";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`Workout ${on ? "logged" : "not logged"}`}
      className="relative shrink-0 cursor-pointer rounded-full transition-colors duration-200"
      style={{
        width: 51,
        height: 31,
        background: on ? "var(--color-accent)" : "rgba(255,255,255,0.15)",
        border: "none",
      }}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{
          width: 27,
          height: 27,
          top: 2,
          left: on ? 22 : 2,
          transition: "left 0.18s ease",
          boxShadow: "0 2px 4px rgba(0,0,0,0.30)",
        }}
      />
    </button>
  );
}

export default function WorkoutCard() {
  const [on, setOn] = useState(false);

  return (
    <GlassCard title="WORKOUT" icon={<Dumbbell size={16} className="text-white" />}>
      <div className="flex items-center justify-between">
        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          {on ? "Logged today" : "Not logged"}
        </span>
        <Toggle on={on} onToggle={() => setOn((v) => !v)} />
      </div>
    </GlassCard>
  );
}
