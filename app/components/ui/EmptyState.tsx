import type { ReactNode } from "react";

// The shared empty-state card: optional icon chip, heading, one line of copy,
// up to two CTA pills (passed as `actions`). Modeled on the Insights tab's
// pattern — the calmest, clearest of the app's historical empty states.
export default function EmptyState({
  icon,
  heading,
  body,
  actions,
  className = "",
}: {
  icon?: ReactNode;
  heading: string;
  body?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card glass-1 p-6 text-center ${className}`}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink">{heading}</p>
      {body && (
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-ink-3">
          {body}
        </p>
      )}
      {actions && <div className="mt-5 flex justify-center gap-2.5">{actions}</div>}
    </div>
  );
}
