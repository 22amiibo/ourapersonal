"use client";

import { useState } from "react";
import type { TrendMetric, TrendResult } from "@/lib/trends";
import MetricHighlightCard from "./MetricHighlightCard";
import MetricDetailView from "./MetricDetailView";

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
          <MetricHighlightCard key={r.metric} result={r} onOpen={() => setOpen(r.metric)} />
        ))}
      </div>

      {openResult && (
        <MetricDetailView metric={openResult.metric} initial={openResult} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
