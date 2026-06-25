// Small client-side motion helpers shared by the entrance / count-up system.
// Everything here is SSR-safe (guards `window`) and honors the user's
// reduced-motion preference, mirroring the global backstop in globals.css.

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// One-shot per browser tab session. Returns true the FIRST time a given key is
// seen (and records it), false afterwards — so entrance animations / count-ups
// fire once and don't replay on every navigation or background refetch.
export function seenThisSession(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const k = `seen:${key}`;
    if (sessionStorage.getItem(k)) return true;
    sessionStorage.setItem(k, "1");
    return false;
  } catch {
    // sessionStorage unavailable (private mode) — treat as already seen so we
    // never animate unpredictably.
    return true;
  }
}

// Has the page already revealed once this session? Used by the reveal gate to
// decide whether new mounts should animate. Pure read (no write).
export function alreadyRevealed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("revealed") === "1";
  } catch {
    return false;
  }
}

// rAF count-up tween from 0 → value. Calls onFrame with each integer step and
// onDone at the end. Returns a cancel function. Reduced-motion callers should
// skip this and render the final value directly.
export function countUp(
  to: number,
  durationMs: number,
  onFrame: (v: number) => void,
  onDone?: () => void,
): () => void {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
    onFrame(to);
    onDone?.();
    return () => {};
  }
  const start = performance.now();
  let raf = 0;
  // easeOutCubic — quick rise that settles, matching the ring's spring feel.
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    onFrame(Math.round(ease(t) * to));
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      onFrame(to);
      onDone?.();
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
