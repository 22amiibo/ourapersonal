"use client";

import { useEffect } from "react";

// Fires one gentle haptic tick as the score rings reveal — the "charge-up"
// confirmation. Once per browser session (sessionStorage) so navigating back to
// the dashboard repeatedly doesn't buzz every time. No-op where unsupported.
export default function HapticReveal() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("rings-haptic")) return;
      sessionStorage.setItem("rings-haptic", "1");
    } catch {
      // sessionStorage unavailable (private mode) — fall through and buzz once.
    }
    const t = setTimeout(() => navigator.vibrate?.([0, 14, 40, 10]), 220);
    return () => clearTimeout(t);
  }, []);
  return null;
}
