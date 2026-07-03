"use client";

import { useState } from "react";

// Unusual days flagged by the daily anomaly pass, with a tap-to-annotate note.
// A saved note becomes context the AI briefing can use ("HRV was low — travel day").

export type AnomalyRow = {
  id: number;
  event_date: string;
  metric: string;
  life_area: string;
  severity: "mild" | "moderate" | "severe";
  direction: "high" | "low";
  z_score: number;
  user_note: string | null;
};

const METRIC_LABEL: Record<string, string> = {
  sleep_hours: "Sleep",
  readiness: "Readiness",
  hrv: "HRV",
  resting_hr: "Resting HR",
  mood_score: "Mood",
  stress_score: "Stress",
};

const SEVERITY_COLOR: Record<AnomalyRow["severity"], string> = {
  mild: "var(--color-ink-3)",
  moderate: "var(--color-amber)",
  severe: "var(--color-rose)",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AnomalyItem({ anomaly }: { anomaly: AnomalyRow }) {
  const [note, setNote] = useState(anomaly.user_note ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(anomaly.user_note != null);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/anomalies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: anomaly.id, note }),
      });
      if (res.ok) {
        setSaved(note.trim().length > 0);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const label = METRIC_LABEL[anomaly.metric] ?? anomaly.metric;

  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-ink">
            {label} unusually {anomaly.direction}
            <span className="ml-1.5 font-mono text-[11px] text-ink-3">{fmtDate(anomaly.event_date)}</span>
          </p>
          {!editing && saved && note.trim() && (
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">“{note.trim()}”</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]"
            style={{
              color: SEVERITY_COLOR[anomaly.severity],
              background: "var(--color-surface-2)",
            }}
          >
            {anomaly.severity}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="min-h-[28px] rounded-pill px-2 text-[11px] font-medium text-accent transition-transform active:scale-95"
          >
            {saved ? "Edit" : "Add note"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened that day?"
            className="min-h-[36px] flex-1 rounded-pill px-3 text-[13px] text-ink"
            style={{ background: "var(--color-surface-2)", border: "0.5px solid rgba(255,255,255,0.10)" }}
          />
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="min-h-[36px] rounded-pill bg-accent px-4 text-[12px] font-semibold text-bg transition-transform active:scale-95 disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      )}
    </li>
  );
}

export default function AnomalyList({ anomalies }: { anomalies: AnomalyRow[] }) {
  if (anomalies.length === 0) return null;

  return (
    <section className="mx-4 rounded-card glass-1 p-5 animate-spring-in">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
        Unusual days
      </p>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-3">
        Days that broke from your baseline. Add context — it sharpens your briefing.
      </p>
      <ul className="divide-y divide-line">
        {anomalies.map((a) => (
          <AnomalyItem key={a.id} anomaly={a} />
        ))}
      </ul>
    </section>
  );
}
