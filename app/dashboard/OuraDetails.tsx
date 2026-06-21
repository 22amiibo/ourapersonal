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

  if (!hasSleepStages && !hasContributors) return null;

  return (
    <div className="space-y-3 px-4">
      {hasSleepStages && (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card animate-spring-in" style={{ animationDelay: "200ms" }}>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Sleep Stages</p>
          <SleepStageBar stages={data!.sleep_stages!} />
        </div>
      )}

      {hasContributors && (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card animate-spring-in" style={{ animationDelay: "240ms" }}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Readiness Contributors</p>
          <ReadinessContributors contributors={data!.readiness_contributors!} />
        </div>
      )}
    </div>
  );
}
