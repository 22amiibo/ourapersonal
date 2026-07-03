import Link from "next/link";
import Sparkline from "@/app/components/ui/Sparkline";

// One square card in the Health Overview's 2×2 grid: label, big mono value,
// a status word, an optional subtitle, and a small trend sparkline — the
// "Option 3A" dashboard-card shape (label/number/status/spark).
export default function HealthMetricCard({
  href,
  label,
  value,
  unit,
  statusLabel,
  statusColor,
  spark,
  subtitle,
}: {
  href: string;
  label: string;
  value: string | null;
  unit?: string;
  statusLabel: string | null;
  statusColor: string;
  spark: number[];
  /** Small supporting line under the status word (e.g. Sleep's "7h 23m asleep"). */
  subtitle?: string | null;
}) {
  const hasSpark = spark.some((v) => v > 0);

  return (
    <Link
      href={href}
      className="flex flex-col justify-between rounded-card glass-1 p-4 transition-transform active:scale-[0.98]"
      style={{ minHeight: 132 }}
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
        <p className="mt-1.5 flex items-baseline gap-1">
          <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-ink">
            {value ?? "—"}
          </span>
          {unit && <span className="text-[12px] font-medium text-ink-3">{unit}</span>}
        </p>
        {statusLabel && (
          <p className="mt-1 text-[11px] font-medium" style={{ color: statusColor }}>
            {statusLabel}
          </p>
        )}
        {subtitle && <p className="mt-0.5 text-[10px] text-ink-3">{subtitle}</p>}
      </div>
      {hasSpark && (
        <div className="mt-2">
          <Sparkline values={spark} width={140} height={28} color={statusColor} />
        </div>
      )}
    </Link>
  );
}
