"use client";
import type { CorrelationResult } from "@/lib/correlation-utils";

export default function CorrelationBar({ r }: { r: CorrelationResult }) {
  if (!r.significant || r.delta == null || r.withFactor == null || r.withoutFactor == null) return null;

  const parts = r.label.split(" → ");
  const factor = parts[0] ?? r.label;
  const metric = parts[1] ?? "";
  const negative = r.delta < 0;
  const baseline = Math.max(r.withFactor, r.withoutFactor);
  const scale = baseline > 0 ? 100 / baseline : 1;
  const withPct = Math.max(0, Math.min(100, r.withFactor * scale));
  const withoutPct = Math.max(0, Math.min(100, r.withoutFactor * scale));

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink capitalize">{factor}</p>
          {metric && <p className="text-[10px] text-ink-3 capitalize">{metric}</p>}
        </div>
        <span className={`shrink-0 tabular-nums font-mono text-[13px] font-semibold ${negative ? "text-rose" : "text-accent"}`}>
          {r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-[46px] shrink-0 text-right text-[10px] text-ink-3">With</span>
          <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-surface-3">
            <div className="h-full rounded-full bg-rose transition-all" style={{ width: `${withPct}%` }} />
          </div>
          <span className="w-[24px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">{r.withFactor}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[46px] shrink-0 text-right text-[10px] text-ink-3">Without</span>
          <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${withoutPct}%` }} />
          </div>
          <span className="w-[24px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">{r.withoutFactor}</span>
        </div>
      </div>
      <p className="text-[10px] text-ink-3">{r.n} nights of data</p>
    </div>
  );
}
