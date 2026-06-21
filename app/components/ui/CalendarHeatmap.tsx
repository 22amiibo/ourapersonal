"use client";

type Cell = { day: string; score: number | null };

function cellColor(score: number | null): string {
  if (score === null) return "var(--color-surface-3)";
  if (score >= 85) return "var(--color-accent)";
  if (score >= 70) return "var(--color-accent-blue)";
  if (score >= 55) return "var(--color-amber)";
  return "var(--color-rose)";
}

export default function CalendarHeatmap({ days, label }: { days: Cell[]; label: string }) {
  const lookup: Record<string, number | null> = {};
  for (const d of days) lookup[d.day] = d.score;

  const today = new Date();
  const cells: { key: string; score: number | null }[] = [];
  const cur = new Date(today);
  cur.setDate(cur.getDate() - 89);
  cur.setDate(cur.getDate() - cur.getDay()); // align to Sunday

  while (cur <= today) {
    const key = cur.toISOString().slice(0, 10);
    cells.push({ key, score: lookup[key] ?? null });
    cur.setDate(cur.getDate() + 1);
  }

  const weeks: { key: string; score: number | null }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <div className="flex gap-[3px] overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.key}
                title={`${cell.key}: ${cell.score ?? "—"}`}
                className="h-[9px] w-[9px] shrink-0 rounded-[2px]"
                style={{ background: cellColor(cell.score) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[10px] text-ink-3">Low</span>
        {[45, 58, 72, 86].map((v) => (
          <div key={v} className="h-[7px] w-[7px] rounded-[1.5px]" style={{ background: cellColor(v) }} />
        ))}
        <span className="text-[10px] text-ink-3">High</span>
      </div>
    </div>
  );
}
