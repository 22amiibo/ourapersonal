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

export function AvatarStack({
  avatars,
  count,
}: {
  avatars: { initials: string; color?: string }[];
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {avatars.map((a, i) => (
          <div
            key={i}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{
              background: a.color ?? "rgba(255,255,255,0.20)",
              border: "1.5px solid white",
              marginLeft: i === 0 ? 0 : -8,
              zIndex: avatars.length - i,
              position: "relative",
            }}
          >
            {a.initials}
          </div>
        ))}
      </div>
      {count !== undefined && (
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
          +{count}
        </span>
      )}
    </div>
  );
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
      className={`glass p-5 transition-transform duration-150 ease active:scale-[0.98] ${className}`}
    >
      {hasHeader && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="shrink-0" style={{ opacity: 0.5 }}>
                {icon}
              </span>
            )}
            {(title || subtitle) && (
              <div>
                {title && (
                  <p className="text-[15px] font-medium leading-none text-white">
                    {title}
                  </p>
                )}
                {subtitle && (
                  <p
                    className="mt-0.5 text-[12px] leading-none"
                    style={{ color: "var(--text-muted)" }}
                  >
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
