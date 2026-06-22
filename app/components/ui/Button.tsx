import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "accent" | "secondary" | "glass";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/**
 * Canonical pill buttons (Expo grammar — see docs/EXPO_DESIGN_GUIDE.md §4).
 * - primary:   max-emphasis ink pill (light-on-dark). One per screen.
 * - accent:    the single sanctioned pop of blue. Never alongside a primary.
 * - secondary: bordered pill (Cancel / low-emphasis).
 * - glass:     frosted glassmorphic pill — matches the bottom-tab chips.
 *
 * All variants: pill radius, min-h-[44px], active:scale-95, no rest shadow.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-bg font-semibold tracking-[-0.01em] disabled:opacity-50",
  accent:
    "bg-accent text-bg font-semibold tracking-[-0.01em] disabled:opacity-50",
  secondary:
    "border border-line-strong bg-surface-2 text-ink font-medium disabled:opacity-50",
  glass:
    "glass-control text-ink font-semibold tracking-[-0.01em] disabled:opacity-50",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`rounded-pill px-5 py-3 text-[14px] transition-transform active:scale-95 min-h-[44px] ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
