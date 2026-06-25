"use client";

import type { Article } from "./types";

// Strip newsletter preheader noise that leaks from the email's plain-text part
// (beehiiv emits "View image: (https://…)" placeholders + bare tracking URLs).
// An unbroken URL also forced horizontal overflow → zoomed-in layout on iOS.
function cleanDesc(s: string): string {
  return s
    .replace(/view image:?\s*\(?https?:\/\/\S+\)?/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Text-only "base block" per email — no banner image (newsletter hero images
// are wide/unpredictable). Title + a short cleaned preview; tap opens the reader.
export default function ArticleCard({ article, onOpen }: { article: Article; onOpen: () => void }) {
  const desc = article.description ? cleanDesc(article.description) : "";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-card p-4 text-left glass-1 transition-transform active:scale-[0.99]"
    >
      <h3 className="break-words text-[17px] font-bold leading-tight text-ink">{article.title}</h3>
      {desc && (
        <p className="mt-1 line-clamp-2 break-words text-[13px] leading-snug text-ink-2">{desc}</p>
      )}
    </button>
  );
}
