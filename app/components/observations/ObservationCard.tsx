"use client";

export type TimelineItem =
  | { kind: "observation"; id: number; body: string; range_start: string; range_end: string; ts: number }
  | { kind: "reflection"; id: number; body: string; date: string; ts: number };

function fmt(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Renders either an AI observation (accent-tinted, sparkle) or a user reflection.
export default function ObservationCard({ item }: { item: TimelineItem }) {
  if (item.kind === "observation") {
    return (
      <div
        className="rounded-card p-5"
        style={{
          background:
            "linear-gradient(157deg, color-mix(in oklch, var(--color-accent) 14%, transparent), color-mix(in oklch, var(--color-accent) 5%, transparent))",
          border: "0.5px solid color-mix(in oklch, var(--color-accent) 30%, transparent)",
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent" aria-hidden>
            <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2z" />
          </svg>
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
            Observation
          </span>
          <span className="ml-auto text-[11px] text-ink-3">
            {fmt(item.range_start)} – {fmt(item.range_end)}
          </span>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{item.body}</p>
      </div>
    );
  }

  return (
    <div className="rounded-card glass-1 p-5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          Reflection
        </span>
        <span className="ml-auto text-[11px] text-ink-3">{fmt(item.date)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{item.body}</p>
    </div>
  );
}
