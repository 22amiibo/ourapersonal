"use client";

import { useState } from "react";
import AskData from "./AskData";
import ObservationsClient from "@/app/components/observations/ObservationsClient";
import EmptyState from "@/app/components/ui/EmptyState";

// The merged intelligence layer: one screen, two segments.
//   Ask      — the AskData composer (one bounded request, unchanged).
//   Patterns — discovered insights + the observation/reflection timeline
//              (everything the old /observations tab showed).
// The reflection composer still lives in the timeline for now — Phase 5 moves
// writing to the Reflect tab so Insights becomes read/ask-only.

export type InsightRow = {
  claim: string;
  evidence_count: number;
  confidence: number;
  life_area: string;
  explanation: string | null;
  status: string;
};

export type InsightsTab = "ask" | "patterns";

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function areaColor(area: string): string {
  switch (area) {
    case "sleep":    return "var(--color-accent-blue)";
    case "fitness":  return "var(--color-accent)";
    case "recovery": return "var(--color-accent)";
    case "focus":    return "var(--color-amber)";
    case "academic": return "var(--color-amber)";
    case "mood":     return "var(--color-rose)";
    default:         return "var(--color-ink-3)";
  }
}

const TABS: { value: InsightsTab; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "patterns", label: "Patterns" },
];

export default function InsightsClient({
  insights,
  initialTab = "ask",
}: {
  insights: InsightRow[];
  initialTab?: InsightsTab;
}) {
  const [tab, setTab] = useState<InsightsTab>(initialTab);

  // Honest thin-data note: any surfaced claim resting on few observations.
  const thinData = insights.length > 0 && insights.some((i) => i.evidence_count < 4);

  return (
    <>
      {/* Segmented control — same visual language as the range toggle. */}
      <div className="mx-4 mb-4">
        <div
          className="flex gap-1 rounded-pill p-1"
          role="tablist"
          aria-label="Insights view"
          style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.10)" }}
        >
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
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
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "ask" ? (
        <AskData />
      ) : (
        <div className="space-y-4">
          {/* ── Discovered insights ─────────────────────────── */}
          {insights.length === 0 ? (
            <div className="mx-4 animate-spring-in">
              <EmptyState
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 12 2z" />
                  </svg>
                }
                heading="Patterns are still forming"
                body="The engine needs about a week of data to find what moves your sleep and recovery. Keep logging and reflecting daily."
                actions={
                  <a href="/reflect" className="flex min-h-[44px] items-center rounded-pill bg-accent px-5 py-2.5 text-[13px] font-semibold text-bg transition-transform active:scale-95">
                    Log &amp; reflect today
                  </a>
                }
              />
            </div>
          ) : (
            <div className="space-y-3 px-4">
              {insights.map((ins, i) => {
                const color = areaColor(ins.life_area);
                const weakening = ins.status === "weakening";
                return (
                  <article
                    key={i}
                    className="rounded-card glass-1 p-5 animate-spring-in"
                    style={{
                      animationDelay: `${i * 40}ms`,
                      opacity: weakening ? 0.74 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                        style={{
                          color,
                          background: `color-mix(in oklch, ${color} 14%, transparent)`,
                        }}
                      >
                        {ins.life_area}
                      </span>
                      {weakening && (
                        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                          weakening
                        </span>
                      )}
                    </div>

                    <h2 className="text-[15px] font-semibold leading-snug text-ink">
                      {ins.claim}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
                        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-2)" }}
                      >
                        {ins.evidence_count} evidence
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
                        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-2)" }}
                      >
                        {fmtPct(ins.confidence)} conf
                      </span>
                    </div>

                    {ins.explanation && (
                      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
                        {ins.explanation}
                      </p>
                    )}
                  </article>
                );
              })}
              {thinData && (
                <p className="px-1 text-[11px] leading-relaxed text-ink-3">
                  Early patterns — some claims rest on limited data. Keep logging for sharper answers.
                </p>
              )}
            </div>
          )}

          {/* ── Observation & reflection timeline ───────────── */}
          <ObservationsClient />
        </div>
      )}
    </>
  );
}
