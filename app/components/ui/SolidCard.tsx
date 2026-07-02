import { ReactNode } from "react";

export default function SolidCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`transition-transform duration-150 ease hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.98] ${className}`}
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "var(--radius-card)",
        padding: 20,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {children}
    </div>
  );
}
