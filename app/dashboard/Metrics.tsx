"use client";

import { useEffect, useState } from "react";

type OuraToday = {
  hrv_avg: number | null;
  resting_hr: number | null;
  temperature_deviation: number | null;
};

type OuraData = { today: OuraToday | null };

function fmtTemp(v: number | null): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

const PILLS: {
  key: keyof OuraToday;
  label: string;
  unit: string;
  format: (v: number | null) => string;
}[] = [
  { key: "hrv_avg",               label: "HRV",        unit: "ms",  format: (v) => (v == null ? "—" : Math.round(v).toString()) },
  { key: "resting_hr",            label: "Resting HR",  unit: "bpm", format: (v) => (v == null ? "—" : Math.round(v).toString()) },
  { key: "temperature_deviation", label: "Body Temp",   unit: "°C",  format: fmtTemp },
];

export default function Metrics() {
  const [data, setData] = useState<OuraData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/oura")
      .then((r) => r.json())
      .then((d: OuraData) => setData(d))
      .catch(() => setData({ today: null }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex gap-2 px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[60px] flex-1 animate-pulse rounded-control bg-surface-2" />
        ))}
      </div>
    );
  }

  const today = data?.today;

  return (
    <div className="flex gap-2 px-4">
      {PILLS.map(({ key, label, unit, format }) => {
        const v = today ? (today[key] as number | null) : null;
        return (
          <div
            key={key}
            className="flex flex-1 flex-col items-center rounded-control border border-line bg-surface-2 px-2 py-3"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
            <p className="mt-1 font-mono text-[15px] font-medium tabular-nums text-ink">
              {format(v)}
              {v != null && unit && (
                <span className="ml-0.5 text-[10px] font-normal text-ink-3">{unit}</span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
