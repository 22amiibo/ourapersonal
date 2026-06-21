"use client";
import { useCallback, useEffect, useState } from "react";

type Goal = { id: number; label: string };
type DoneMap = Record<number, boolean>;

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <polyline points="1.5 6 4.5 9 10.5 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HabitCheckins() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [done, setDone] = useState<DoneMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/habits");
      if (res.ok) {
        const d = await res.json();
        setGoals(d.goals ?? []);
        const map: DoneMap = {};
        for (const id of (d.completed ?? [])) map[id] = true;
        setDone(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: number) {
    const wasDone = done[id];
    setDone((prev) => ({ ...prev, [id]: !wasDone }));
    if (wasDone) {
      await fetch(`/api/habits?goal_id=${id}`, { method: "DELETE" });
    } else {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: id }),
      });
    }
  }

  if (loading || goals.length === 0) return null;

  const completedCount = goals.filter((g) => done[g.id]).length;

  return (
    <section
      className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in"
      style={{ animationDelay: "400ms" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Today&apos;s Goals
        </p>
        <span className="text-[12px] font-medium tabular-nums text-ink-3">
          {completedCount}/{goals.length}
        </span>
      </div>
      <ul className="space-y-2">
        {goals.map((g) => {
          const checked = !!done[g.id];
          return (
            <li key={g.id}>
              <button
                onClick={() => toggle(g.id)}
                className="flex w-full items-center gap-3 min-h-[44px] rounded-control border px-4 py-3 transition-all active:scale-[0.98]"
                style={{
                  borderColor: checked ? "var(--color-accent)" : "var(--color-line)",
                  background: checked
                    ? "color-mix(in oklch, var(--color-accent) 8%, var(--color-surface-2))"
                    : "var(--color-surface-2)",
                }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                  style={{
                    borderColor: checked ? "var(--color-accent)" : "var(--color-line-strong)",
                    background: checked ? "var(--color-accent)" : "transparent",
                    color: checked ? "var(--color-bg)" : "transparent",
                  }}
                >
                  <CheckIcon />
                </span>
                <span className={`text-[14px] transition-colors ${checked ? "line-through text-ink-3" : "text-ink-2"}`}>
                  {g.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
