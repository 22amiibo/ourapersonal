"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Article } from "./types";

// In-app browser sheet for links tapped *inside* an article. Never hands off to
// the system browser. Some sites block embedding (X-Frame-Options); a fallback
// notice is shown, but we still never navigate the app away.
function InAppLink({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to article"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="truncate font-mono text-[12px] text-ink-3">{url}</span>
      </div>
      <iframe src={url} title="In-app link" className="flex-1 w-full border-0" />
    </div>
  );
}

export default function ArticleReader({ article, onClose }: { article: Article; onClose: () => void }) {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portal target only exists on the client; gate render until mounted.
  useEffect(() => setMounted(true), []);

  // No body `overflow:hidden` lock: it's unreliable on iOS and, with a portaled
  // fixed overlay, can stop the reader's own scroller from receiving touch
  // (the "frozen article" bug). The opaque full-screen overlay hides the page
  // and `overscroll-contain` on the scroller prevents scroll-chaining instead.

  // Close on Escape (external keyboards / desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Intercept in-article link taps → open the in-app sheet, not Safari.
  function onBodyClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (href && /^https?:\/\//i.test(href)) {
      e.preventDefault();
      setLinkUrl(href);
    }
  }

  if (!mounted) return null;

  // Rendered via a portal to <body> so it sits above everything and is free of
  // the Articles list's pull-to-refresh touch handlers — letting the reader
  // scroll its full height on iOS.
  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      style={{ background: "var(--color-bg)" }}
      role="dialog"
      aria-modal="true"
      aria-label={article.title}
    >
      {/* The slide-up entrance lives on this inner wrapper, NOT the fixed
          overlay: a lingering transform (animation-fill `both` settles at
          translateY(0)) on a fixed ancestor breaks inner scrolling on iOS.
          `h-dvh` gives the scroller a definite viewport height regardless of
          the body chain. */}
      <div className="relative h-dvh animate-sheet-up">
        {/* Pinned close — always reachable while the article scrolls beneath it. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close article"
          className="absolute right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full text-white"
          style={{ top: "calc(env(safe-area-inset-top) + 12px)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        >
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>

        <div
          className="h-full overflow-y-auto overflow-x-clip overscroll-contain no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="relative">
            {article.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.image_url} alt="" className="h-64 w-full object-cover" />
            ) : (
              <div
                className="h-40 w-full"
                style={{ background: "linear-gradient(135deg, color-mix(in oklch, var(--color-accent) 40%, #0a0a0f), #0a0a0f)" }}
              />
            )}
          </div>

          <article className="mx-auto max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-5">
            <h1 className="text-[28px] font-bold leading-tight text-ink text-balance">{article.title}</h1>
            <div
              className="article-body mt-4 text-[16px] leading-relaxed text-ink-2"
              onClick={onBodyClick}
              dangerouslySetInnerHTML={{ __html: article.body_html ?? "" }}
            />
          </article>
        </div>
      </div>

      {linkUrl && <InAppLink url={linkUrl} onClose={() => setLinkUrl(null)} />}
    </div>,
    document.body,
  );
}
