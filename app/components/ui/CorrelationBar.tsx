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

  // When delta < 0 (factor hurts), "with" is worse → rose; "without" is better → accent
  // When delta > 0 (factor helps), "with" is better → accent; "without" is worse → rose
  const withColor = negative ? "var(--color-rose)" : "var(--color-accent)";
  const withoutColor = negative ? "var(--color-accent)" : "var(--color-rose)";

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink capitalize">{factor}</p>
          {metric && <p className="mt-0.5 text-[11px] text-ink-3 capitalize">→ {metric}</p>}
        </div>
        <div className="shrink-0 text-right">
          <span
            className="font-mono text-[15px] font-bold tabular-nums"
            style={{ color: negative ? "var(--color-rose)" : "var(--color-accent)" }}
          >
            {r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}
          </span>
          <p className="text-[10px] text-ink-3">{r.n} nights</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-[46px] shrink-0 text-right text-[10px] text-ink-3">With</span>
          <div className="flex-1 h-[6px] rounded-full overflow-hidden bg-surface-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${withPct}%`, background: withColor }} />
          </div>
          <span className="w-[26px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">{r.withFactor}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[46px] shrink-0 text-right text-[10px] text-ink-3">Without</span>
          <div className="flex-1 h-[6px] rounded-full overflow-hidden bg-surface-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${withoutPct}%`, background: withoutColor }} />
          </div>
          <span className="w-[26px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">{r.withoutFactor}</span>
        </div>
      </div>
    </div>
  );
}
