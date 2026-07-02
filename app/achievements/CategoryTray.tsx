"use client";

import { useState, type ReactNode } from "react";

// Progressive disclosure for a category's award grid: the first 4 cards show
// as a 2×2; the rest sit behind a quiet "Show all (N)" row that toggles back
// to "Show less". Cards arrive pre-rendered from the server page — this
// component owns only the disclosure state.
export default function CategoryTray({
  cards,
  initialVisible = 4,
}: {
  cards: ReactNode[];
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = cards.length > initialVisible;
  const shown = expanded || !collapsible ? cards : cards.slice(0, initialVisible);

  return (
    <div
      className="rounded-[24px] p-2.5"
      style={{
        background: "color-mix(in oklch, var(--color-ink) 3.5%, transparent)",
        border: "0.5px solid var(--color-line)",
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">{shown}</div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-control text-[13px] font-semibold text-ink-2 transition-transform active:scale-[0.99]"
        >
          {expanded ? "Show less" : `Show all (${cards.length})`}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            style={{
              transition: "transform .25s cubic-bezier(.22,1,.36,1)",
              transform: expanded ? "rotate(180deg)" : "none",
            }}
          >
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
