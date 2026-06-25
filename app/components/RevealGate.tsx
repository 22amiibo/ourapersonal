"use client";

import { useEffect } from "react";

// Marks the document as "revealed" once per browser-tab session. After the
// first reveal, the global rule `html[data-revealed] main .animate-* { animation:none }`
// neutralizes entrance animations so moving between tabs (or a background
// refetch remounting a card) never replays every entrance — motion reads as
// intentional, not twitchy. The page-transition (template `page-enter`) and
// modal/reader animations live outside <main> and keep firing.
//
// On the very first session load we wait out the longest entrance (~1.3s) so we
// don't snap an in-flight animation; on reloads/returns the inline <head>
// script in layout.tsx has already set the attribute pre-paint (no flash).
export default function RevealGate() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("revealed") === "1") {
        document.documentElement.setAttribute("data-revealed", "1");
        return;
      }
    } catch {
      // sessionStorage blocked — leave entrances ungated rather than risk
      // hiding content.
      return;
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem("revealed", "1");
      } catch {
        /* ignore */
      }
      document.documentElement.setAttribute("data-revealed", "1");
    }, 1400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
