"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export default function QuoteBanner({
  quote = "Every day is a new opportunity to grow and become a better version of yourself.",
}: {
  quote?: string;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderLeft: "2px solid rgba(255,255,255,0.20)",
        borderRadius: 14,
        padding: "14px 18px",
      }}
    >
      <p
        className="flex-1 text-[13px] italic leading-snug"
        style={{ color: "rgba(255,255,255,0.80)", fontWeight: 300 }}
      >
        {quote}
      </p>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 transition-opacity hover:opacity-60 active:opacity-40"
        aria-label="Dismiss"
      >
        <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
      </button>
    </div>
  );
}
