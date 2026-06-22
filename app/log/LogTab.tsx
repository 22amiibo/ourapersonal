"use client";

import { useState, useTransition } from "react";
import Button from "@/app/components/ui/Button";

export type IntakeEntry = {
  id: number;
  type: "caffeine" | "alcohol" | "note" | "workout";
  quantity: number;
  unit: string;
  timestamp: string;
  note: string | null;
};

type ModalState = { type: "caffeine" | "alcohol" | "note" | "workout" } | null;

const WORKOUT_TYPES = ["Run", "Lift", "Yoga", "Swim", "Cardio", "Walk", "Bike", "HIIT", "Other"];

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

const QUICK_ADDS = [
  { label: "Coffee",   type: "caffeine" as const, quantity: 100, unit: "mg",    note: undefined },
  { label: "Espresso", type: "caffeine" as const, quantity: 75,  unit: "mg",    note: undefined },
  { label: "Tea",      type: "caffeine" as const, quantity: 40,  unit: "mg",    note: undefined },
  { label: "Energy",   type: "caffeine" as const, quantity: 160, unit: "mg",    note: undefined },
  { label: "Run",      type: "workout"  as const, quantity: 30,  unit: "min",   note: "Run"    },
  { label: "Lift",     type: "workout"  as const, quantity: 45,  unit: "min",   note: "Lift"   },
  { label: "Drink",    type: "alcohol"  as const, quantity: 1,   unit: "drinks",note: undefined },
];

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
  const [modal, setModal] = useState<ModalState>(null);
  const [quantity, setQuantity] = useState("");
  const [noteText, setNoteText] = useState("");
  const [timestamp, setTimestamp] = useState(nowDatetimeLocal);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [caffeineWarning, setCaffeineWarning] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [workoutType, setWorkoutType] = useState(WORKOUT_TYPES[0]);

  const isToday = selectedDate === initialDate;

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

  function openModal(type: "caffeine" | "alcohol" | "note" | "workout") {
    setQuantity(type === "caffeine" ? "100" : type === "alcohol" ? "1" : type === "workout" ? "30" : "");
    setNoteText("");
    setTimestamp(nowDatetimeLocal());
    setError("");
    setCaffeineWarning(false);
    setWorkoutType(WORKOUT_TYPES[0]);
    setModal({ type });
  }

  function closeModal() {
    setModal(null);
  }

  function submit() {
    if (!modal) return;

    let body: Record<string, unknown>;

    if (modal.type === "note") {
      if (!noteText.trim()) {
        setError("Enter a note.");
        return;
      }
      body = {
        type: "note",
        quantity: 0,
        unit: "",
        timestamp: new Date(timestamp).toISOString(),
        note: noteText.trim(),
      };
    } else if (modal.type === "workout") {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        setError("Enter a valid duration.");
        return;
      }
      body = {
        type: "workout",
        quantity: qty,
        unit: "min",
        timestamp: new Date(timestamp).toISOString(),
        note: workoutType + (noteText.trim() ? ` — ${noteText.trim()}` : ""),
      };
    } else {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        setError("Enter a valid quantity.");
        return;
      }
      body = {
        type: modal.type,
        quantity: qty,
        unit: modal.type === "caffeine" ? "mg" : "drinks",
        timestamp: new Date(timestamp).toISOString(),
        note: noteText.trim() || undefined,
      };
    }

    startTransition(async () => {
      const res = await fetch("/api/log/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const { entry } = (await res.json()) as { entry: IntakeEntry };
        setEntries((prev) => [entry, ...prev]);
        if (entry.type === "caffeine" && new Date(entry.timestamp).getHours() >= 14) {
          setCaffeineWarning(true);
        }
        closeModal();
      } else {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Failed to save.");
      }
    });
  }

  async function quickAdd(item: typeof QUICK_ADDS[number]) {
    const body = {
      type: item.type,
      quantity: item.quantity,
      unit: item.unit,
      timestamp: new Date().toISOString(),
      note: item.note ?? undefined,
    };
    const res = await fetch("/api/log/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const { entry } = (await res.json()) as { entry: IntakeEntry };
      setEntries((prev) => [entry, ...prev]);
      if (entry.type === "caffeine" && new Date(entry.timestamp).getHours() >= 14) {
        setCaffeineWarning(true);
      }
    }
  }

  const todayCaffeine = entries
    .filter((e) => e.type === "caffeine")
    .reduce((sum, e) => sum + e.quantity, 0);
  const todayAlcohol = entries
    .filter((e) => e.type === "alcohol")
    .reduce((sum, e) => sum + e.quantity, 0);

  const modalTitle =
    modal?.type === "caffeine" ? "Log Caffeine"
    : modal?.type === "alcohol" ? "Log Alcohol"
    : modal?.type === "workout" ? "Log Workout"
    : "Log Note";

  return (
    <>
      <main className="mx-auto max-w-md space-y-5 pb-28 pt-5">
        <header className="px-4 animate-spring-in">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Daily Log</h1>
          <p className="mt-0.5 text-[14px] text-ink-2">Caffeine, alcohol, workouts &amp; notes</p>
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

        {/* Quick-add chips — one-tap common items */}
        {isToday && (
          <div className="px-4 animate-spring-in" style={{ animationDelay: "120ms" }}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Quick Add</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_ADDS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => quickAdd(item)}
                  className="shrink-0 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-[13px] font-semibold text-ink transition-transform active:scale-95 min-h-[44px]"
                >
                  {item.label}
                  <span className="ml-1 font-mono text-[11px] font-normal text-ink-3">
                    {item.type === "caffeine" ? `${item.quantity}mg` : item.type === "workout" ? `${item.quantity}m` : "×1"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Intake buttons */}
        <div className="grid grid-cols-4 gap-2 px-4 animate-spring-in" style={{ animationDelay: "160ms" }}>
          {([
            { type: "caffeine" as const, icon: <CoffeeIcon s="h-5 w-5" />, label: "Caffeine" },
            { type: "alcohol"  as const, icon: <DrinkIcon  s="h-5 w-5" />, label: "Alcohol" },
            { type: "workout"  as const, icon: <WorkoutIcon s="h-5 w-5" />, label: "Workout" },
            { type: "note"     as const, icon: <NoteIcon   s="h-5 w-5" />, label: "Note" },
          ]).map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => openModal(type)}
              className="flex flex-col items-center gap-1.5 rounded-[18px] glass-1 px-1 py-3 text-ink-2 transition-transform active:scale-[0.97] min-h-[64px]"
            >
              {icon}
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          ))}
        </div>

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
              <p className="mt-1 text-[13px] text-ink-3">Tap a button above to start tracking.</p>
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

      {/* Bottom sheet modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(11,12,14,0.7)", backdropFilter: "blur(4px)" }}
          onClick={closeModal}
        >
          <div
            className="w-full rounded-t-sheet glass-2 px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line-strong" />

            <div className="mb-5 border-b border-line pb-4">
              <h2 className="text-[17px] font-semibold text-ink">{modalTitle}</h2>
            </div>

            <div className="space-y-4">
              {modal.type === "note" ? (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Note</label>
                  <textarea
                    rows={4}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full resize-none rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              ) : modal.type === "workout" ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Type</label>
                    <select
                      value={workoutType}
                      onChange={(e) => setWorkoutType(e.target.value)}
                      className="w-full rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[48px]"
                    >
                      {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Duration (min)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g. 30"
                      className="w-full rounded-control border border-line bg-bg px-4 py-3.5 font-mono text-[15px] text-ink focus:border-accent focus:outline-none min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Note (optional)</label>
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="e.g. Morning tempo run"
                      className="w-full rounded-control border border-line bg-bg px-4 py-3.5 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[48px]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                      {modal.type === "caffeine" ? "Amount (mg)" : "Drinks"}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={modal.type === "caffeine" ? "e.g. 100" : "e.g. 1"}
                      className="w-full rounded-control border border-line bg-bg px-4 py-3.5 font-mono text-[15px] text-ink focus:border-accent focus:outline-none min-h-[48px]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder={
                        modal.type === "caffeine"
                          ? "e.g. Espresso after lunch"
                          : "e.g. Glass of wine"
                      }
                      className="w-full rounded-control border border-line bg-bg px-4 py-3.5 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[48px]"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Time</label>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full rounded-control border border-line bg-bg px-4 py-3.5 font-mono text-[14px] text-ink focus:border-accent focus:outline-none min-h-[48px]"
                />
              </div>

              {error && <p className="text-[13px] text-rose">{error}</p>}

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" onClick={closeModal} className="flex-1">
                  Cancel
                </Button>
                <Button variant="primary" onClick={submit} disabled={isPending} className="flex-1">
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
