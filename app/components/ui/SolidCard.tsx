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
        background: "var(--surface-solid)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "var(--card-radius)",
        padding: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.30)",
      }}
    >
      {children}
    </div>
  );
}
