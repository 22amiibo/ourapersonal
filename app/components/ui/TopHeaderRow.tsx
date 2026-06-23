"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import QuoteBanner from "./QuoteBanner";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TopHeaderRow({
  username = "Ziyad",
  hasUnread = true,
  quote,
}: {
  username?: string;
  hasUnread?: boolean;
  quote?: string;
}) {
  const [greet, setGreet] = useState("");

  useEffect(() => {
    setGreet(greeting());
  }, []);

  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-normal" style={{ color: "var(--text-muted)" }}>
            {greet}
          </span>
          <span className="text-[17px] font-bold text-white">{username}</span>
        </div>

        <button
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-[0.92]"
          style={{
            background: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(16px) saturate(1.8)",
            WebkitBackdropFilter: "blur(16px) saturate(1.8)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
          aria-label="Notifications"
        >
          <Bell size={18} className="text-white" style={{ opacity: 0.85 }} />
          {hasUnread && (
            <span
              className="absolute right-2 top-2 h-2 w-2 rounded-full"
              style={{ background: "var(--color-accent)" }}
              aria-label="unread notifications"
            />
          )}
        </button>
      </div>

      <QuoteBanner quote={quote} />
    </div>
  );
}
