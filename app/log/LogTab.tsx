"use client";

import { useState, type ReactNode } from "react";
import CaffeineSlider from "@/app/components/inputs/CaffeineSlider";
import AlcoholCounter from "@/app/components/inputs/AlcoholCounter";
import WorkoutSlider from "@/app/components/inputs/WorkoutSlider";
import MoodSlider from "@/app/components/inputs/MoodSlider";
import Sparkline from "@/app/components/ui/Sparkline";

export type IntakeEntry = {
  id: number;
  type: "caffeine" | "alcohol" | "note" | "workout";
  quantity: number;
  unit: string;
  timestamp: string;
  note: string | null;
};

type InputType = "caffeine" | "alcohol" | "workout";
type OpenInput = InputType | "mood" | null;

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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

function unitFor(type: InputType): string {
  return type === "caffeine" ? "mg" : type === "alcohol" ? "drinks" : "min";
}

function labelFor(type: InputType, qty: number): string {
  if (type === "caffeine") return `${qty} mg`;
  if (type === "alcohol") return `${qty} drink${qty === 1 ? "" : "s"}`;
  return `${qty} min`;
}

const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronDown = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
    style={{ transition: "transform .25s cubic-bezier(.22,1,.36,1)", transform: open ? "rotate(180deg)" : "none" }}>
    <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TrashIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const UndoIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.3-9.3L3 7"/></svg>;

type WeeklyStats = { caffeine_mg: number; alcohol_drinks: number; workout_days: number } | null;

// A collapsible input row — compact header (label + today's value), expands the
// bare control on tap. One row open at a time (parent holds the single key).
function InputRow({
  label,
  summary,
  summaryColor,
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  summaryColor?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card glass-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[14px] font-semibold text-ink">{label}</span>
        <span className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium tabular-nums" style={{ color: summaryColor ?? "var(--color-ink-2)" }}>
            {summary}
          </span>
          <span className="text-ink-3"><ChevronDown open={open} /></span>
        </span>
      </button>
      {open && <div className="animate-fade-in border-t border-line">{children}</div>}
    </div>
  );
}

// A generic secondary-info disclosure (This week / History) — closed by default
// to keep the screen calm, opens to reveal detail.
function Disclosure({
  label,
  hint,
  open,
  onToggle,
  children,
}: {
  label: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card glass-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="flex items-center gap-2">
          {hint && <span className="text-[12px] tabular-nums text-ink-3">{hint}</span>}
          <span className="text-ink-3"><ChevronDown open={open} /></span>
        </span>
      </button>
      {open && <div className="animate-fade-in border-t border-line p-4">{children}</div>}
    </div>
  );
}

export default function LogTab({
  initialEntries,
  initialDate,
  weeklyStats,
  moodSeries: initialMoodSeries = [],
  moodToday: initialMoodToday = null,
}: {
  initialEntries: IntakeEntry[];
  initialDate: string;
  weeklyStats?: WeeklyStats;
  moodSeries?: number[];
  moodToday?: number | null;
}) {
  // Today's entries — back the status chips, logging, and Undo. Kept distinct
  // from the History browser so logging never corrupts a past-day view.
  const [todayEntries, setTodayEntries] = useState<IntakeEntry[]>(initialEntries);
  const [caffeineWarning, setCaffeineWarning] = useState(false);
  const [quickBusy, setQuickBusy] = useState<InputType | null>(null);
  const [moodSeries, setMoodSeries] = useState<number[]>(initialMoodSeries);
  const [moodToday, setMoodToday] = useState<number | null>(initialMoodToday);
  const [moodBusy, setMoodBusy] = useState(false);
  const [lastLog, setLastLog] = useState<{ id: number; label: string } | null>(null);

  // Which input row is expanded (one at a time).
  const [openInput, setOpenInput] = useState<OpenInput>(null);
  // Secondary disclosures.
  const [weekOpen, setWeekOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // History browser — its own date + entries, loaded on demand.
  const [histDate, setHistDate] = useState(initialDate);
  const [histEntries, setHistEntries] = useState<IntakeEntry[]>(initialEntries);
  const [histLoading, setHistLoading] = useState(false);
  const histIsToday = histDate === initialDate;

  function toggleInput(k: OpenInput) {
    setOpenInput((prev) => (prev === k ? null : k));
  }

  // Direct (no-modal) log used by the Inputs controls. Targets *today*; if the
  // History browser is also on today, mirror the change so its list stays live.
  async function logAmount(type: InputType, quantity: number) {
    setQuickBusy(type);
    try {
      const res = await fetch("/api/log/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantity, unit: unitFor(type), timestamp: new Date().toISOString() }),
      });
      if (res.ok) {
        const { entry } = (await res.json()) as { entry: IntakeEntry };
        setTodayEntries((prev) => [entry, ...prev]);
        if (histIsToday) setHistEntries((prev) => [entry, ...prev]);
        setLastLog({ id: entry.id, label: labelFor(type, quantity) });
        if (type === "caffeine" && new Date(entry.timestamp).getHours() >= 14) setCaffeineWarning(true);
      }
    } finally {
      setQuickBusy(null);
    }
  }

  async function logMood(mood: number, tags: string[]) {
    setMoodBusy(true);
    try {
      const res = await fetch("/api/log/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, tags }),
      });
      if (res.ok) {
        setMoodSeries((prev) => (moodToday != null && prev.length > 0 ? [...prev.slice(0, -1), mood] : [...prev, mood]));
        setMoodToday(mood);
      }
    } finally {
      setMoodBusy(false);
    }
  }

  async function loadHistDate(date: string) {
    setHistLoading(true);
    try {
      const res = await fetch(`/api/log/intake?date=${date}`);
      if (res.ok) {
        const { entries: loaded } = (await res.json()) as { entries: IntakeEntry[] };
        setHistEntries(loaded);
        setHistDate(date);
      }
    } finally {
      setHistLoading(false);
    }
  }

  async function deleteEntry(id: number) {
    const res = await fetch(`/api/log/intake?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setHistEntries((prev) => prev.filter((e) => e.id !== id));
      setTodayEntries((prev) => prev.filter((e) => e.id !== id));
      setLastLog((prev) => (prev?.id === id ? null : prev));
    }
  }

  const todayCaffeine = todayEntries.filter((e) => e.type === "caffeine").reduce((s, e) => s + e.quantity, 0);
  const todayAlcohol = todayEntries.filter((e) => e.type === "alcohol").reduce((s, e) => s + e.quantity, 0);
  const todayWorkoutMin = todayEntries.filter((e) => e.type === "workout").reduce((s, e) => s + e.quantity, 0);

  const caffeineColor = todayCaffeine > 400 ? "var(--color-rose)" : todayCaffeine > 200 ? "var(--color-amber)" : "var(--color-ink)";
  const alcoholColor = todayAlcohol >= 3 ? "var(--color-rose)" : todayAlcohol >= 2 ? "var(--color-amber)" : "var(--color-ink)";
  const moodColor = moodToday == null ? "var(--color-ink-3)" : moodToday >= 7 ? "var(--color-success)" : moodToday >= 4 ? "var(--color-warning)" : "var(--color-danger)";

  // At-a-glance "what have I logged today" — the single source of today state.
  const chips = [
    { key: "caffeine" as OpenInput, label: "Caffeine", value: todayCaffeine > 0 ? `${todayCaffeine}` : "—", unit: "mg", color: todayCaffeine > 0 ? caffeineColor : "var(--color-ink-3)" },
    { key: "alcohol" as OpenInput, label: "Alcohol", value: todayAlcohol > 0 ? `${todayAlcohol}` : "—", unit: todayAlcohol === 1 ? "drink" : "drinks", color: todayAlcohol > 0 ? alcoholColor : "var(--color-ink-3)" },
    { key: "workout" as OpenInput, label: "Workout", value: todayWorkoutMin > 0 ? `${todayWorkoutMin}` : "—", unit: "min", color: todayWorkoutMin > 0 ? "var(--color-ink)" : "var(--color-ink-3)" },
    { key: "mood" as OpenInput, label: "Mood", value: moodToday != null ? `${moodToday}` : "—", unit: "/10", color: moodColor },
  ];

  return (
    <main className="mx-auto max-w-md space-y-4 pb-28 pt-5">
      <header className="px-4 animate-spring-in">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Inputs</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">Caffeine, alcohol, workouts &amp; mood</p>
      </header>

      {/* Today status — at-a-glance logged state. Tap a chip to open its input. */}
      <div className="grid grid-cols-4 gap-2 px-4 animate-spring-in">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => toggleInput(c.key)}
            className="rounded-control glass-1 px-1.5 py-2.5 text-center transition-transform active:scale-95"
          >
            <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-ink-3">{c.label}</p>
            <p className="mt-1 font-mono text-[17px] font-semibold leading-none tabular-nums" style={{ color: c.color }}>
              {c.value}
            </p>
            <p className="mt-0.5 text-[9px] text-ink-3">{c.unit}</p>
          </button>
        ))}
      </div>

      {caffeineWarning && (
        <div className="mx-4 rounded-control border border-amber/30 bg-amber/5 px-4 py-3 text-[13px] text-amber animate-fade-in">
          Heads up — caffeine after 2 pm may affect tonight&apos;s sleep.
        </div>
      )}

      {/* Input accordion — calm by default, expand on tap. */}
      <div className="space-y-2.5 px-4">
        <InputRow label="Caffeine" summary={todayCaffeine > 0 ? `${todayCaffeine} mg` : "Log"} summaryColor={todayCaffeine > 0 ? caffeineColor : undefined} open={openInput === "caffeine"} onToggle={() => toggleInput("caffeine")}>
          <CaffeineSlider bare busy={quickBusy === "caffeine"} onConfirm={(mg) => logAmount("caffeine", mg)} />
        </InputRow>
        <InputRow label="Alcohol" summary={todayAlcohol > 0 ? `${todayAlcohol} drink${todayAlcohol === 1 ? "" : "s"}` : "Log"} summaryColor={todayAlcohol > 0 ? alcoholColor : undefined} open={openInput === "alcohol"} onToggle={() => toggleInput("alcohol")}>
          <AlcoholCounter bare busy={quickBusy === "alcohol"} onConfirm={(n) => logAmount("alcohol", n)} />
        </InputRow>
        <InputRow label="Workout" summary={todayWorkoutMin > 0 ? `${todayWorkoutMin} min` : "Log"} open={openInput === "workout"} onToggle={() => toggleInput("workout")}>
          <WorkoutSlider bare busy={quickBusy === "workout"} onConfirm={(m) => logAmount("workout", m)} />
        </InputRow>
        <InputRow label="Mood" summary={moodToday != null ? `${moodToday}/10` : "Log"} summaryColor={moodToday != null ? moodColor : undefined} open={openInput === "mood"} onToggle={() => toggleInput("mood")}>
          <MoodSlider bare busy={moodBusy} onConfirm={(mood, tags) => logMood(mood, tags)} />
        </InputRow>

        {lastLog && (
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={() => deleteEntry(lastLog.id)}
              className="flex min-h-[44px] items-center gap-2 rounded-pill px-4 py-2.5 text-[13px] font-semibold text-accent transition-transform active:scale-95"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 13%, transparent)",
                border: "0.5px solid color-mix(in oklch, var(--color-accent) 45%, transparent)",
              }}
            >
              <UndoIcon />
              Undo {lastLog.label}
            </button>
          </div>
        )}
      </div>

      {/* Secondary info — tucked behind disclosures. */}
      <div className="space-y-2.5 px-4">
        {weeklyStats && (
          <Disclosure label="This week" open={weekOpen} onToggle={() => setWeekOpen((v) => !v)}>
            <div className="flex gap-2">
              {[
                { label: "Caffeine", val: `${weeklyStats.caffeine_mg}mg` },
                { label: "Alcohol", val: `${weeklyStats.alcohol_drinks} drinks` },
                { label: "Workouts", val: `${weeklyStats.workout_days}×` },
              ].map((s) => (
                <div key={s.label} className="flex-1 rounded-control glass-1 p-3 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">{s.label}</p>
                  <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-ink">{s.val}</p>
                  <p className="text-[9px] text-ink-3">7-day</p>
                </div>
              ))}
            </div>
            {moodSeries.length >= 2 && (
              <div className="mt-3 rounded-control glass-1 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Mood · 14 days</span>
                  {moodToday != null && (
                    <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">
                      {moodToday}<span className="ml-0.5 text-[11px] font-normal text-ink-3">/10</span>
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <Sparkline values={moodSeries} width={320} height={40} />
                </div>
              </div>
            )}
          </Disclosure>
        )}

        <Disclosure
          label="History"
          hint={histIsToday ? `${histEntries.length} today` : formatDateLabel(histDate, initialDate)}
          open={historyOpen}
          onToggle={() => setHistoryOpen((v) => !v)}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => !histLoading && loadHistDate(shiftDate(histDate, -1))}
              disabled={histLoading}
              aria-label="Previous day"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-line text-ink-2 transition-transform active:scale-95 disabled:opacity-40"
            >
              <ChevronLeft />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{formatDateLabel(histDate, initialDate)}</span>
              {histLoading && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />}
            </div>
            <button
              onClick={() => !histLoading && !histIsToday && loadHistDate(shiftDate(histDate, 1))}
              disabled={histLoading || histIsToday}
              aria-label="Next day"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-line text-ink-2 transition-transform active:scale-95 disabled:opacity-40"
            >
              <ChevronRight />
            </button>
          </div>
          {histEntries.length === 0 ? (
            <div className="rounded-control glass-1 p-5 text-center">
              <p className="text-[14px] font-medium text-ink">Nothing logged {histIsToday ? "today" : "this day"}.</p>
              <p className="mt-1 text-[13px] text-ink-3">Use the inputs above to start tracking.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {histEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 rounded-control glass-1 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    {entry.type === "note" ? (
                      <span className="text-[12px] text-ink-3">{formatTime(entry.timestamp)}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[15px] font-medium tabular-nums text-ink">{entry.quantity} {entry.unit}</span>
                        <span className="text-[12px] text-ink-3">{formatTime(entry.timestamp)}</span>
                      </div>
                    )}
                    {entry.note && (
                      <p className={`mt-1 text-[13px] leading-snug ${entry.type === "note" ? "text-ink" : "truncate text-ink-3"}`}>{entry.note}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    aria-label="Delete entry"
                    className="mt-0.5 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-ink-3 transition-colors hover:text-rose active:scale-95"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Disclosure>
      </div>
    </main>
  );
}
