"use client";

import { useEffect, useRef } from "react";
import { countUp, prefersReducedMotion, seenThisSession } from "@/lib/motion";

// A number that ticks 0 → value the first time it's revealed this session.
// SSR renders the final value (correct for no-JS / first paint); the client
// animates by writing textContent on a ref, so there's never a hydration
// mismatch. Reduced-motion and repeat visits show the final value instantly.
export default function CountUp({
  value,
  seenKey,
  durationMs = 900,
  className,
  style,
  fallback = "—",
}: {
  value: number | null | undefined;
  // Unique per logical number so each animates once per session (e.g.
  // "wellness", "ring-readiness"). Two instances sharing a key → only the
  // first animates.
  seenKey: string;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
  fallback?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const has = value != null && Number.isFinite(value);
  const target = has ? Math.round(value as number) : null;

  useEffect(() => {
    const el = ref.current;
    if (el == null || target == null) return;
    if (prefersReducedMotion() || seenThisSession(`countup:${seenKey}`)) {
      el.textContent = String(target);
      return;
    }
    return countUp(target, durationMs, (v) => {
      el.textContent = String(v);
    });
  }, [target, seenKey, durationMs]);

  return (
    <span ref={ref} className={className} style={style}>
      {has ? target : fallback}
    </span>
  );
}
