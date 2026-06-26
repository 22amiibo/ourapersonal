"use client";

import { useState } from "react";

// Mood logger — a 1–10 slider (matching the other Inputs sliders) plus optional
// context chips. Confirm calls onConfirm(mood, tags); the parent posts to
// /api/log/mood and updates the recent-mood trend.
const MOOD_TAGS = ["calm", "anxious", "tired", "energized", "focused", "social", "low", "irritable"];
const MAX_TAGS = 5;

export default function MoodSlider({
  busy = false,
  bare = false,
  onConfirm,
}: {
  busy?: boolean;
  bare?: boolean;
  onConfirm: (mood: number, tags: string[]) => void;
}) {
  const [mood, setMood] = useState(6);
  const [tags, setTags] = useState<string[]>([]);

  const moodColor =
    mood >= 7 ? "var(--color-success)" : mood >= 4 ? "var(--color-warning)" : "var(--color-danger)";

  function toggle(t: string) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= MAX_TAGS ? prev : [...prev, t],
    );
  }

  const body = (
    <>
      <div className={`${bare ? "" : "mt-3 "}flex items-end gap-1.5`}>
        <span
          className="font-mono text-[40px] font-semibold leading-none tabular-nums"
          style={{ color: moodColor }}
        >
          {mood}
        </span>
        <span className="mb-1 text-[14px] text-ink-3">/ 10</span>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={mood}
        onChange={(e) => setMood(Number(e.target.value))}
        aria-label="Mood from 1 to 10"
        className="mt-4 h-2 w-full cursor-pointer"
        style={{ accentColor: moodColor }}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {MOOD_TAGS.map((t) => {
          const on = tags.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-pressed={on}
              className="rounded-full px-3 py-1.5 text-[12px] transition-transform active:scale-95"
              style={
                on
                  ? {
                      background: "color-mix(in oklch, var(--color-accent) 16%, transparent)",
                      border: "0.5px solid color-mix(in oklch, var(--color-accent) 50%, transparent)",
                      color: "var(--color-accent)",
                    }
                  : {
                      background: "var(--color-surface-2)",
                      border: "0.5px solid var(--color-line)",
                      color: "var(--color-ink-2)",
                    }
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onConfirm(mood, tags)}
        disabled={busy}
        className="mt-4 min-h-[44px] w-full rounded-pill bg-accent px-5 py-3.5 text-[14px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? "Logging…" : "Log mood"}
      </button>
    </>
  );

  if (bare) return <div className="px-5 pb-5 pt-4">{body}</div>;
  return (
    <div className="rounded-card glass-1 p-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Mood</span>
      {body}
    </div>
  );
}
