import type { ReactNode } from "react";

// Small muted group header that names a section of cards ("Your Day",
// "Your Body"). Quiet by design — an eyebrow for the group, one visual level
// above the eyebrows the cards carry themselves.
export default function SectionHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-[length:var(--text-label)] font-medium uppercase tracking-[0.1em] text-ink-3 ${className}`}
    >
      {children}
    </h2>
  );
}
