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

// List card per IMG_0873: image banner (rounded top) + title/description on the
// dark lower half. Image/title/description come straight from the feed — no AI.
export default function ArticleCard({ article, onOpen }: { article: Article; onOpen: () => void }) {
  const desc = article.description ? cleanDesc(article.description) : "";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-card text-left glass-1 transition-transform active:scale-[0.99]"
    >
      {article.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.image_url} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div
          className="h-32 w-full"
          style={{ background: "linear-gradient(135deg, color-mix(in oklch, var(--color-accent) 40%, #0a0a0f), #0a0a0f)" }}
        />
      )}
      <div className="p-3.5">
        <h3 className="break-words text-[17px] font-bold leading-tight text-ink">{article.title}</h3>
        {desc && (
          <p className="mt-0.5 line-clamp-2 break-words text-[13px] leading-snug text-ink-2">{desc}</p>
        )}
      </div>
    </button>
  );
}
