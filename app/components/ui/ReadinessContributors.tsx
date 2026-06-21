const CONTRIBUTOR_LABELS: Record<string, string> = {
  hrv_balance:         "HRV Balance",
  recovery_index:      "Recovery Index",
  resting_heart_rate:  "Resting HR",
  sleep_balance:       "Sleep Balance",
  body_temperature:    "Body Temp",
  previous_day_activity: "Activity Load",
  previous_night:      "Previous Night",
};

function arrow(score: number): { symbol: string; color: string } {
  if (score >= 80) return { symbol: "↑", color: "var(--color-accent)" };
  if (score >= 60) return { symbol: "→", color: "var(--color-ink-3)" };
  return { symbol: "↓", color: "var(--color-rose)" };
}

export default function ReadinessContributors({
  contributors,
}: {
  contributors: Record<string, number>;
}) {
  const entries = Object.entries(CONTRIBUTOR_LABELS)
    .map(([key, label]) => ({ key, label, score: contributors[key] }))
    .filter((e) => typeof e.score === "number");

  if (entries.length === 0) return null;

  return (
    <div className="space-y-0">
      {entries.map(({ key, label, score }, i) => {
        const { symbol, color } = arrow(score);
        return (
          <div
            key={key}
            className={`flex items-center justify-between py-2.5 ${
              i < entries.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className="text-[13px] text-ink-2">{label}</span>
            <div className="flex items-center gap-1.5">
              <div
                className="h-1 rounded-full bg-surface-3"
                style={{ width: 48 }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${score}%`, background: color }}
                />
              </div>
              <span className="font-mono text-[12px] tabular-nums" style={{ color, minWidth: 18 }}>
                {symbol}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-ink-3" style={{ minWidth: 24 }}>
                {score}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
