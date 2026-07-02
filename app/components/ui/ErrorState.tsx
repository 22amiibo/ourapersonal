"use client";

// The shared failure surface: quiet danger-tinted panel with a plain-language
// message and an optional retry. Deliberately restrained — a hairline tint,
// not a loud red block — per the app's semantic-color discipline.
export default function ErrorState({
  heading,
  body,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: {
  heading: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-control px-4 py-3.5 ${className}`}
      style={{
        border: "0.5px solid color-mix(in oklch, var(--color-danger) 30%, transparent)",
        background: "color-mix(in oklch, var(--color-danger) 6%, transparent)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: "var(--color-danger)" }}>
            {heading}
          </p>
          {body && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{body}</p>}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-pill border border-line-strong bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-ink transition-transform active:scale-95 min-h-[44px]"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
