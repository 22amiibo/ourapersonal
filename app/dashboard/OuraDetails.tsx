"use client";

import { useEffect, useState } from "react";
import SleepStageBar from "@/app/components/ui/SleepStageBar";
import ReadinessContributors from "@/app/components/ui/ReadinessContributors";

type SleepStages = { rem: number | null; deep: number | null; light: number | null; awake: number | null };
type OuraToday = {
  sleep_stages: SleepStages | null;
  readiness_contributors: Record<string, number> | null;
  steps: number | null;
  active_calories: number | null;
};

function fmtSteps(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function OuraDetails() {
  const [data, setData] = useState<OuraToday | null>(null);

  useEffect(() => {
    fetch("/api/oura")
      .then((r) => r.json())
      .then((d: { today: OuraToday | null }) => setData(d.today))
      .catch(() => {});
  }, []);

  const hasSleepStages = data?.sleep_stages && (
    (data.sleep_stages.rem ?? 0) + (data.sleep_stages.deep ?? 0) +
    (data.sleep_stages.light ?? 0) + (data.sleep_stages.awake ?? 0)
  ) > 0;
  const hasContributors = data?.readiness_contributors &&
    Object.keys(data.readiness_contributors).length > 0;
  const hasActivity = data?.steps != null || data?.active_calories != null;

  if (!hasSleepStages && !hasContributors && !hasActivity) return null;

  return (
    <div className="space-y-3 px-4">
      {/* Activity summary strip */}
      {hasActivity && (
        <div className="flex gap-2 animate-spring-in" style={{ animationDelay: "180ms" }}>
          {data?.steps != null && (
            <div className="glass-1 flex-1 rounded-control px-3 py-2.5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Steps</p>
              <p className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-ink">{fmtSteps(data.steps)}</p>
            </div>
          )}
          {data?.active_calories != null && (
            <div className="glass-1 flex-1 rounded-control px-3 py-2.5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Active Cal</p>
              <p className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-ink">{data.active_calories}</p>
            </div>
          )}
        </div>
      )}

      {hasSleepStages && (
        <div className="rounded-card glass-1 p-4 animate-spring-in" style={{ animationDelay: "200ms" }}>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Stages</p>
          <SleepStageBar stages={data!.sleep_stages!} />
        </div>
      )}

      {hasContributors && (
        <div className="rounded-card glass-1 p-4 animate-spring-in" style={{ animationDelay: "240ms" }}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Readiness Contributors</p>
          <ReadinessContributors contributors={data!.readiness_contributors!} />
        </div>
      )}
    </div>
  );
}
