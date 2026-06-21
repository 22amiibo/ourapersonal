type SleepStages = {
  rem: number | null;
  deep: number | null;
  light: number | null;
  awake: number | null;
};

const STAGES = [
  { key: "deep" as const, label: "Deep", color: "#7c6cf8" },
  { key: "rem" as const,  label: "REM",  color: "var(--color-accent-blue)" },
  { key: "light" as const,label: "Light", color: "var(--color-accent)" },
  { key: "awake" as const,label: "Awake", color: "var(--color-amber)" },
];

function fmtMin(secs: number | null): string {
  if (secs == null || secs === 0) return "—";
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function SleepStageBar({ stages }: { stages: SleepStages }) {
  const total = (stages.rem ?? 0) + (stages.deep ?? 0) + (stages.light ?? 0) + (stages.awake ?? 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {STAGES.map(({ key, color }) => {
          const val = stages[key] ?? 0;
          const pct = (val / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, background: color }}
              className="h-full first:rounded-l-full last:rounded-r-full"
            />
          );
        })}
      </div>
      <div className="flex justify-between">
        {STAGES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[10px] text-ink-3">{label}</span>
            <span className="font-mono text-[10px] text-ink-2">{fmtMin(stages[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
