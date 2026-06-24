"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import type { TrendMetric, TrendResult } from "@/lib/trends";
import MetricHighlightCard from "./MetricHighlightCard";
import MetricDetailView from "./MetricDetailView";

// Drive a state change through the View Transitions API so the highlight card's
// chart morphs into the detail sheet (shared-element transition). flushSync makes
// React commit synchronously inside the callback so the API captures the new DOM.
// Falls back to a plain update where unsupported or when motion is reduced.
function withTransition(fn: () => void) {
  const start =
    typeof document !== "undefined"
      ? (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition
      : undefined;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (start && !reduce) {
    start.call(document, () => flushSync(fn));
  } else {
    fn();
  }
}

// Owns the highlight grid + which metric's detail overlay is open. Receives the
// preloaded weekly (W) trends from the server page; detail fetches D/M on demand.
export default function TrendsClient({ results }: { results: TrendResult[] }) {
  const [open, setOpen] = useState<TrendMetric | null>(null);
  const openResult = results.find((r) => r.metric === open) ?? null;

  return (
    <>
      <p className="px-5 pb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
        Highlights
      </p>
      <div className="space-y-3 px-4">
        {results.map((r) => (
          <MetricHighlightCard
            key={r.metric}
            result={r}
            active={open === r.metric}
            onOpen={() => withTransition(() => setOpen(r.metric))}
          />
        ))}
      </div>

      {openResult && (
        <MetricDetailView
          metric={openResult.metric}
          initial={openResult}
          onClose={() => withTransition(() => setOpen(null))}
        />
      )}
    </>
  );
}
