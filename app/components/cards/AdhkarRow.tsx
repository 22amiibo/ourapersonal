"use client";

import { useState } from "react";

const TABS = ["Morning", "Evening", "Night"] as const;
type Tab = (typeof TABS)[number];

export default function AdhkarRow() {
  const [active, setActive] = useState<Tab>("Morning");

  return (
    <div
      className="flex w-full gap-1 p-1"
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 100,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="flex-1 py-2 text-[13px] font-medium transition-all duration-200 active:scale-[0.97]"
            style={{
              borderRadius: 100,
              background: isActive ? "white" : "transparent",
              color: isActive ? "black" : "var(--text-muted)",
              border: "none",
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
