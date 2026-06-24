"use client";

import { useState } from "react";
import CaffeineSlider from "@/app/components/inputs/CaffeineSlider";
import AlcoholCounter from "@/app/components/inputs/AlcoholCounter";

export type IntakeEntry = {
  id: number;
  type: "caffeine" | "alcohol" | "note" | "workout";
  quantity: number;
  unit: string;
  timestamp: string;
  note: string | null;
};

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function formatDateLabel(date: string, today: string): string {
  if (date === today) return "Today";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const TrashIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;

const SVG = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
// Monochrome by default — icons inherit currentColor (Expo: no decorative color
// in chrome; semantic color lives in the data, e.g. the caffeine day-total).
const CoffeeIcon = ({ s = "h-7 w-7" }) => <SVG c={s}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></SVG>;
const DrinkIcon = ({ s = "h-7 w-7" }) => <SVG c={s}><path d="M8 22h8M12 11v11M3 2l2.5 14.5a2 2 0 0 0 2 1.5h9a2 2 0 0 0 2-1.5L21 2H3z"/></SVG>;
const NoteIcon  = ({ s = "h-7 w-7" }) => <SVG c={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></SVG>;
const WorkoutIcon = ({ s = "h-7 w-7" }) => <SVG c={s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></SVG>;

function EntryIcon({ type }: { type: IntakeEntry["type"] }) {
  if (type === "caffeine") return <CoffeeIcon s="h-5 w-5" />;
  if (type === "alcohol") return <DrinkIcon s="h-5 w-5" />;
  if (type === "workout") return <WorkoutIcon s="h-5 w-5" />;
  return <NoteIcon s="h-5 w-5" />;
}

type WeeklyStats = { caffeine_mg: number; alcohol_drinks: number; workout_days: number } | null;

export default function LogTab({
  initialEntries,
  initialDate,
  weeklyStats,
}: {
  initialEntries: IntakeEntry[];
  initialDate: string;
  weeklyStats?: WeeklyStats;
}) {
  const [entries, setEntries] = useState<IntakeEntry[]>(initialEntries);
  const [caffeineWarning, setCaffeineWarning] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [quickBusy, setQuickBusy] = useState<"caffeine" | "alcohol" | null>(null);

  const isToday = selectedDate === initialDate;

  // Direct (no-modal) log used by the Inputs slider/counter. Posts to the same
  // /api/log/intake endpoint and prepends the new entry to the timeline.
  async function logAmount(type: "caffeine" | "alcohol", quantity: number) {
    setQuickBusy(type);
    try {
      const res = await fetch("/api/log/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          quantity,
          unit: type === "caffeine" ? "mg" : "drinks",
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const { entry } = (await res.json()) as { entry: IntakeEntry };
        setEntries((prev) => [entry, ...prev]);
        if (type === "caffeine" && new Date(entry.timestamp).getHours() >= 14) {
          setCaffeineWarning(true);
        }
      }
    } finally {
      setQuickBusy(null);
    }
  }

  async function loadDate(date: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/log/intake?date=${date}`);
      if (res.ok) {
        const { entries: loaded } = (await res.json()) as { entries: IntakeEntry[] };
        setEntries(loaded);
        setSelectedDate(date);
      }
    } finally {
      setLoading(false);
    }
  }

  function goPrev() {
    if (loading) return;
    loadDate(shiftDate(selectedDate, -1));
  }

  function goNext() {
    if (loading || isToday) return;
    loadDate(shiftDate(selectedDate, 1));
  }

  async function deleteEntry(id: number) {
    const res = await fetch(`/api/log/intake?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  const todayCaffeine = entries
    .filter((e) => e.type === "caffeine")
    .reduce((sum, e) => sum + e.quantity, 0);
  const todayAlcohol = entries
    .filter((e) => e.type === "alcohol")
    .reduce((sum, e) => sum + e.quantity, 0);

  return (
    <main className="mx-auto max-w-md space-y-5 pb-28 pt-5">
      <header className="px-4 animate-spring-in">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Inputs</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">Caffeine &amp; alcohol</p>
      </header>

      {weeklyStats && (
        <div className="flex gap-2 px-4 animate-spring-in">
          {[
            { label: "Caffeine", val: `${weeklyStats.caffeine_mg}mg` },
            { label: "Alcohol", val: `${weeklyStats.alcohol_drinks} drinks` },
            { label: "Workouts", val: `${weeklyStats.workout_days}×` },
          ].map((s) => (
            <div key={s.label} className="flex-1 rounded-card glass-1 p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">{s.label}</p>
              <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-ink">{s.val}</p>
              <p className="text-[9px] text-ink-3">7-day</p>
            </div>
          ))}
        </div>
      )}

      {caffeineWarning && (
        <div className="mx-4 rounded-control border border-amber/30 bg-amber/5 px-4 py-3.5 text-[14px] text-amber animate-spring-in">
          Heads up — caffeine after 2 pm may affect tonight&apos;s sleep.
        </div>
      )}

      {/* Day totals */}
      <div className="flex gap-2.5 px-4 animate-spring-in" style={{ animationDelay: "80ms" }}>
        <div className="flex-1 rounded-card glass-1 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Caffeine</p>
          <p className="mt-1.5 font-mono text-lg font-medium tabular-nums"
            style={{ color: todayCaffeine > 400 ? "var(--color-rose)" : todayCaffeine > 200 ? "var(--color-amber)" : "var(--color-ink)" }}>
            {todayCaffeine}
            <span className="ml-1 text-[11px] font-normal text-ink-3">mg</span>
          </p>
          {todayCaffeine > 400 && (
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-rose)" }}>Over daily limit</p>
          )}
          {todayCaffeine > 200 && todayCaffeine <= 400 && (
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-amber)" }}>Moderate intake</p>
          )}
        </div>
        <div className="flex-1 rounded-card glass-1 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Alcohol</p>
          <p className="mt-1.5 font-mono text-lg font-medium tabular-nums"
            style={{ color: todayAlcohol >= 3 ? "var(--color-rose)" : todayAlcohol >= 2 ? "var(--color-amber)" : "var(--color-ink)" }}>
            {todayAlcohol}
            <span className="ml-1 text-[11px] font-normal text-ink-3">drinks</span>
          </p>
          {todayAlcohol >= 3 && (
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-rose)" }}>Will impact sleep</p>
          )}
        </div>
      </div>

      {/* Primary Inputs — caffeine slider (25 mg steps) + alcohol counter */}
      {isToday && (
        <div className="grid grid-cols-1 gap-2.5 px-4 animate-spring-in" style={{ animationDelay: "100ms" }}>
          <CaffeineSlider busy={quickBusy === "caffeine"} onConfirm={(mg) => logAmount("caffeine", mg)} />
          <AlcoholCounter busy={quickBusy === "alcohol"} onConfirm={(n) => logAmount("alcohol", n)} />
        </div>
      )}

      {/* Timeline */}
      <section className="px-4 animate-spring-in" style={{ animationDelay: "240ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={loading}
            aria-label="Previous day"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-line text-ink-2 transition-transform active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {formatDateLabel(selectedDate, initialDate)}
            </span>
            {loading && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
            )}
          </div>
          <button
            onClick={goNext}
            disabled={loading || isToday}
            aria-label="Next day"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-line text-ink-2 transition-transform active:scale-95 disabled:opacity-40"
          >
            <ChevronRight />
          </button>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-card glass-1 p-5 text-center">
            <p className="text-[14px] font-medium text-ink">Nothing logged {isToday ? "today" : "this day"}.</p>
            <p className="mt-1 text-[13px] text-ink-3">Use the inputs above to start tracking.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-card glass-1 px-4 py-4"
              >
                <span className="mt-0.5 shrink-0 text-ink-2">
                  <EntryIcon type={entry.type} />
                </span>
                <div className="min-w-0 flex-1">
                  {entry.type === "note" ? (
                    <span className="text-[12px] text-ink-3">{formatTime(entry.timestamp)}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-medium tabular-nums text-ink">
                        {entry.quantity} {entry.unit}
                      </span>
                      <span className="text-[12px] text-ink-3">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                  )}
                  {entry.note && (
                    <p
                      className={`mt-1 text-[13px] leading-snug ${
                        entry.type === "note" ? "text-ink" : "truncate text-ink-3"
                      }`}
                    >
                      {entry.note}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  aria-label="Delete entry"
                  className="mt-0.5 shrink-0 text-ink-3 transition-colors hover:text-rose active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
