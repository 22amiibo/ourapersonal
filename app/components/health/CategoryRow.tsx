import Link from "next/link";
import Sparkline from "@/app/components/ui/Sparkline";
import type { HealthCategory } from "./categories";

// Apple-Health-style browse row: icon chip, category name, current headline
// value, 14-day sparkline, chevron. Pure presentation — the overview page
// computes the numbers. Server-safe (no state).
export default function CategoryRow({
  category,
  headline,
  spark,
}: {
  category: HealthCategory;
  /** Formatted current value ("84", "62 ms") or null when no data. */
  headline: string | null;
  /** Recent daily values for the mini sparkline; hidden if all zero/empty. */
  spark: number[];
}) {
  const tint = category.color;
  const hasSpark = spark.some((v) => v > 0);

  return (
    <Link
      href={`/health/${category.key}`}
      className="flex items-center gap-3.5 rounded-card glass-1 px-4 py-4 transition-transform active:scale-[0.99]"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
        style={{
          background: tint
            ? `color-mix(in oklch, ${tint} 14%, transparent)`
            : "var(--color-bg-soft)",
          color: tint ?? "var(--color-ink-2)",
        }}
      >
        {category.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">
          {category.label}
        </span>
        <span className="block truncate text-[12px] text-ink-3">
          {category.sublabel}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {headline != null && (
          <span className="font-mono text-[17px] font-semibold tabular-nums text-ink">
            {headline}
          </span>
        )}
        {hasSpark && (
          <Sparkline
            values={spark}
            width={56}
            height={22}
            color={tint ?? "var(--color-ink-3)"}
          />
        )}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ink-3">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
