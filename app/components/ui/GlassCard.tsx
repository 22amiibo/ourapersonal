import { ReactNode } from "react";

interface GlassCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function GlassCard({
  title,
  subtitle,
  icon,
  badge,
  footer,
  children,
  className = "",
}: GlassCardProps) {
  const hasHeader = icon || title || badge;
  return (
    <div
      className={`glass-1 rounded-card p-5 transition-transform duration-150 ease active:scale-[0.98] ${className}`}
    >
      {hasHeader && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="shrink-0 opacity-50">{icon}</span>
            )}
            {(title || subtitle) && (
              <div>
                {title && (
                  <p className="text-[length:var(--text-body-l)] font-medium leading-none text-ink">
                    {title}
                  </p>
                )}
                {subtitle && (
                  <p className="mt-0.5 text-[length:var(--text-body-s)] leading-none text-ink-2">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
          {badge}
        </div>
      )}

      {children}

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
