"use client";

import type { Article } from "./types";

// List card per IMG_0873: image banner (rounded top) + title/description on the
// dark lower half. Image/title/description come straight from the feed — no AI.
export default function ArticleCard({ article, onOpen }: { article: Article; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-card text-left glass-1 transition-transform active:scale-[0.99]"
    >
      {article.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.image_url} alt="" className="h-44 w-full object-cover" />
      ) : (
        <div
          className="h-44 w-full"
          style={{ background: "linear-gradient(135deg, color-mix(in oklch, var(--color-accent) 40%, #0a0a0f), #0a0a0f)" }}
        />
      )}
      <div className="p-4">
        <h3 className="text-[20px] font-bold leading-tight text-ink">{article.title}</h3>
        {article.description && (
          <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink-2">{article.description}</p>
        )}
      </div>
    </button>
  );
}
