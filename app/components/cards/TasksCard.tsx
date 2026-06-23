"use client";

import { CheckSquare } from "lucide-react";
import GlassCard from "../ui/GlassCard";

export default function TasksCard() {
  return (
    <GlassCard
      title="TASKS"
      icon={<CheckSquare size={16} className="text-white" />}
      footer={
        <button
          className="text-[14px] font-medium transition-opacity hover:opacity-80 active:opacity-60"
          style={{ color: "var(--color-accent)" }}
        >
          + Manage
        </button>
      }
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          No tasks yet
        </p>
        <p
          className="mt-0.5 text-[11px]"
          style={{ color: "var(--text-muted)", opacity: 0.6 }}
        >
          Tap to add
        </p>
      </div>
    </GlassCard>
  );
}
