import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

type WeeklyRow = {
  week_of: string;
  sleep_avg: string | null;
  readiness_avg: string | null;
  hrv_avg: string | null;
  resting_hr_avg: string | null;
  confidence_level: string | null;
  notable_note: string | null;
};

type NarrativeRow = {
  month_of: string;
  narrative: string;
};

function fmt(v: string | null): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line bg-bg/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default async function WeeklyPage() {
  const weeks = (await sql`
    SELECT
      to_char(week_of, 'YYYY-MM-DD') AS week_of,
      sleep_avg, readiness_avg, hrv_avg, resting_hr_avg, confidence_level, notable_note
    FROM weekly_patterns
    WHERE user_id = ${USER_ID}
    ORDER BY week_of DESC
    LIMIT 12
  `) as WeeklyRow[];

  let narratives: NarrativeRow[] = [];
  try {
    narratives = (await sql`
      SELECT to_char(month_of, 'YYYY-MM') AS month_of, narrative
      FROM narratives WHERE user_id = ${USER_ID} ORDER BY month_of DESC LIMIT 3
    `) as NarrativeRow[];
  } catch {
    narratives = [];
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Weekly</h1>
        <p className="mt-0.5 text-sm text-ink-2">Your last 12 weeks</p>
      </header>

      {narratives.length > 0 && (
        <section className="space-y-3">
          {narratives.map((n) => (
            <div key={n.month_of} className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">{n.month_of} — Monthly review</p>
              <p className="text-sm leading-relaxed text-ink-2">{n.narrative}</p>
            </div>
          ))}
        </section>
      )}

      {weeks.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <p className="text-sm text-ink-3">No weekly summaries yet. They're generated at the start of each week.</p>
        </div>
      ) : (
        weeks.map((w) => (
          <section key={w.week_of} className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Week of {w.week_of}</p>
              {w.confidence_level != null && (
                <span className="font-mono text-[11px] tabular-nums text-ink-3">confidence {fmt(w.confidence_level)}/10</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Sleep" value={fmt(w.sleep_avg)} />
              <Stat label="Readiness" value={fmt(w.readiness_avg)} />
              <Stat label="HRV" value={fmt(w.hrv_avg)} />
              <Stat label="Resting HR" value={fmt(w.resting_hr_avg)} />
            </div>
            {w.notable_note && (
              <p className="border-t border-line pt-3 text-sm italic leading-relaxed text-ink-2">"{w.notable_note}"</p>
            )}
          </section>
        ))
      )}
    </main>
  );
}
