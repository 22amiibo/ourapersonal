"use client";

import TrendChart from "@/app/components/ui/TrendChart";

const SLEEP_DATA = [72, 78, 65, 81, 74, 85, 79];
const READY_DATA = [68, 75, 70, 82, 71, 88, 76];
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function HealthTab() {
  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Health</h1>
        <p className="mt-0.5 text-sm text-ink-2">7-day trends</p>
      </header>

      {/* Trend charts */}
      <section className="rounded-card border border-line bg-surface p-4 shadow-card space-y-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Health Trends</p>

        <div className="space-y-1.5">
          <p className="text-xs text-ink-3">Sleep score</p>
          <TrendChart data={SLEEP_DATA} labels={LABELS} min={0} max={100} />
        </div>

        <div className="h-px bg-line" />

        <div className="space-y-1.5">
          <p className="text-xs text-ink-3">Readiness score</p>
          <TrendChart data={READY_DATA} labels={LABELS} min={0} max={100} />
        </div>
      </section>

      {/* Last night Oura summary */}
      <section className="rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">
          Last Night (Oura)
        </p>
        <div className="flex gap-2.5">
          <div className="flex-1 rounded-control border border-line bg-bg/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Sleep</p>
            <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink-3">—</p>
          </div>
          <div className="flex-1 rounded-control border border-line bg-bg/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Readiness</p>
            <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink-3">—</p>
          </div>
        </div>
        <div className="mt-3 rounded-control border border-line bg-bg/40 p-3">
          <p className="text-sm text-ink-3">
            Connect Oura in{" "}
            <a href="/settings" className="text-accent underline-offset-2 hover:underline">
              Settings
            </a>{" "}
            to see last night's data.
          </p>
        </div>
      </section>
    </main>
  );
}
