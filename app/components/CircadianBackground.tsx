"use client";

import { useEffect } from "react";

/**
 * Drives the circadian canvas. Reads the local hour and sets CSS custom
 * properties on :root that the `body::before` gradient consumes, so the
 * ambient background shifts hue across the day:
 *
 *   dawn (5–8)     indigo/violet, low light
 *   day  (8–16)    brand mint, barely there
 *   golden (16–20) warm amber
 *   dusk (20–23)   deep indigo
 *   night (23–5)   near-dark, dim
 *
 * Renders nothing. Re-evaluates on mount and when the tab regains focus,
 * and on a slow interval so an open session crosses phase boundaries.
 */

type Phase = {
  hueTop: number;
  hueBottom: number;
  topAlpha: number;
  bottomAlpha: number;
};

function phaseForHour(h: number): Phase {
  // dawn
  if (h >= 5 && h < 8) return { hueTop: 268, hueBottom: 32, topAlpha: 0.13, bottomAlpha: 0.05 };
  // day
  if (h >= 8 && h < 16) return { hueTop: 168, hueBottom: 40, topAlpha: 0.10, bottomAlpha: 0.06 };
  // golden hour
  if (h >= 16 && h < 20) return { hueTop: 34, hueBottom: 12, topAlpha: 0.15, bottomAlpha: 0.07 };
  // dusk
  if (h >= 20 && h < 23) return { hueTop: 252, hueBottom: 280, topAlpha: 0.13, bottomAlpha: 0.06 };
  // night
  return { hueTop: 248, hueBottom: 250, topAlpha: 0.07, bottomAlpha: 0.03 };
}

export default function CircadianBackground() {
  useEffect(() => {
    const apply = () => {
      const p = phaseForHour(new Date().getHours());
      const root = document.documentElement.style;
      root.setProperty("--circ-hue-top", String(p.hueTop));
      root.setProperty("--circ-hue-bottom", String(p.hueBottom));
      root.setProperty("--circ-top-alpha", String(p.topAlpha));
      root.setProperty("--circ-bottom-alpha", String(p.bottomAlpha));
    };

    apply();
    window.addEventListener("focus", apply);
    const id = window.setInterval(apply, 10 * 60 * 1000); // every 10 min
    return () => {
      window.removeEventListener("focus", apply);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
