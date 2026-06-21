import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import WeeklyShareButton from "./WeeklyShareButton";

type WeeklyRow = {
  week_of: string;
  sleep_avg: string | null;
  readiness_avg: string | null;
  hrv_avg: string | null;
  resting_hr_avg: string | null;
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

function formatWeekRange(weekOf: string): string {
  const [y, m, d] = weekOf.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 12));
  const end = new Date(Date.UTC(y, m - 1, d + 6, 12));
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatMonthLabel(monthOf: string): string {
  const [y, m] = monthOf.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

type Grade = { letter: string; color: string };

function grade(score: string | null): Grade {
  const n = Number(score);
  if (!score || !Number.isFinite(n)) return { letter: "—", color: "var(--color-ink-3)" };
  if (n >= 85) return { letter: "A", color: "var(--color-accent)" };
  if (n >= 75) return { letter: "B", color: "var(--color-accent-blue)" };
  if (n >= 65) return { letter: "C", color: "var(--color-amber)" };
  if (n >= 55) return { letter: "D", color: "var(--color-amber)" };
  return { letter: "F", color: "var(--color-rose)" };
}

function delta(a: string | null, b: string | null): string | null {
  const va = Number(a);
  const vb = Number(b);
  if (!a || !b || !Number.isFinite(va) || !Number.isFinite(vb)) return null;
  const d = va - vb;
  return (d >= 0 ? "+" : "") + d.toFixed(1);
}

function deltaColor(d: string | null): string {
  if (!d) return "var(--color-ink-3)";
  return d.startsWith("+") ? "var(--color-accent)" : "var(--color-rose)";
}

function Stat({ label, value, g, change }: { label: string; value: string; g: Grade; change?: string | null }) {
  return (
    <div className="rounded-control border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
        <span className="font-mono text-[15px] font-bold" style={{ color: g.color }}>{g.letter}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-mono text-[18px] font-semibold tabular-nums text-ink">{value}</p>
        {change && (
          <span className="font-mono text-[11px] tabular-nums" style={{ color: deltaColor(change) }}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

function StatPlain({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line bg-surface-2 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default async function WeeklyPage() {
  const weeks = (await sql`
    SELECT
      to_char(week_of, 'YYYY-MM-DD') AS week_of,
      sleep_avg, readiness_avg, hrv_avg, resting_hr_avg, notable_note
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
    <main className="mx-auto max-w-md space-y-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <header className="px-4 animate-spring-in">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Weekly</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">Last 12 weeks</p>
      </header>

      {narratives.length > 0 && (
        <section className="space-y-3 animate-spring-in" style={{ animationDelay: "80ms" }}>
          {narratives.map((n) => (
            <div key={n.month_of} className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                {formatMonthLabel(n.month_of)}
              </p>
              <p className="text-[15px] leading-relaxed text-ink-2">{n.narrative}</p>
            </div>
          ))}
        </section>
      )}

      {narratives.length > 0 && weeks.length > 0 && (
        <div className="mx-4 h-px bg-line" />
      )}

      {weeks.length === 0 ? (
        <div className="mx-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in" style={{ animationDelay: "160ms" }}>
          <p className="text-[14px] leading-relaxed text-ink-3">
            No weekly data yet. Your patterns will appear here after a week of tracking.
          </p>
        </div>
      ) : (
        weeks.map((w, i) => {
          const prev = weeks[i + 1] ?? null;
          const sleepGrade = grade(w.sleep_avg);
          const readyGrade = grade(w.readiness_avg);
          const sleepDelta = i === 0 && prev ? delta(w.sleep_avg, prev.sleep_avg) : null;
          const readyDelta = i === 0 && prev ? delta(w.readiness_avg, prev.readiness_avg) : null;

          return (
            <section
              key={w.week_of}
              className="mx-4 space-y-4 rounded-card border border-line bg-surface p-5 shadow-card animate-spring-in"
              style={{ animationDelay: `${(i + 2) * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  {formatWeekRange(w.week_of)}
                </p>
                {i === 0 && (
                  <WeeklyShareButton
                    weekRange={formatWeekRange(w.week_of)}
                    sleep={fmt(w.sleep_avg)}
                    readiness={fmt(w.readiness_avg)}
                    hrv={fmt(w.hrv_avg)}
                    note={w.notable_note ?? undefined}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Sleep" value={fmt(w.sleep_avg)} g={sleepGrade} change={sleepDelta} />
                <Stat label="Readiness" value={fmt(w.readiness_avg)} g={readyGrade} change={readyDelta} />
                <StatPlain label="HRV" value={fmt(w.hrv_avg)} />
                <StatPlain label="Resting HR" value={fmt(w.resting_hr_avg)} />
              </div>
              {w.notable_note && (
                <p className="border-t border-line pt-4 text-[14px] italic leading-relaxed text-ink-2">
                  &ldquo;{w.notable_note}&rdquo;
                </p>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
