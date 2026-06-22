"use client";

import { useState } from "react";
import { Sparkles, BarChart2, History, Settings } from "lucide-react";

const PILLS = [
  { id: "fx",       icon: Sparkles,  label: "FX" },
  { id: "chart",    icon: BarChart2, label: "Chart" },
  { id: "history",  icon: History,   label: "History" },
  { id: "settings", icon: Settings,  label: "Settings" },
] as const;

type PillId = (typeof PILLS)[number]["id"];

export default function FxButtonRow({
  defaultActive = "fx",
  onSelect,
}: {
  defaultActive?: PillId;
  onSelect?: (id: PillId) => void;
}) {
  const [active, setActive] = useState<PillId>(defaultActive);

  const handleSelect = (id: PillId) => {
    setActive(id);
    onSelect?.(id);
  };

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5">
      {PILLS.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-white transition-transform duration-150 active:scale-[0.95]"
            style={{
              height: 36,
              paddingLeft: 16,
              paddingRight: 16,
              borderRadius: 100,
              background: isActive
                ? "color-mix(in oklch, var(--color-accent) 15%, transparent)"
                : "var(--color-surface-2)",
              border: isActive
                ? "1px solid var(--color-accent)"
                : "1px solid var(--color-line)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: isActive ? "var(--color-accent)" : "var(--text-muted)",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
