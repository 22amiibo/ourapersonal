"use client";

import { useRef, useState } from "react";
import type { Article } from "./types";
import ArticleCard from "./ArticleCard";
import ArticleReader from "./ArticleReader";

const PULL_THRESHOLD = 70;

export default function ArticlesClient({ initial }: { initial: Article[] }) {
  const [articles, setArticles] = useState<Article[]>(initial);
  const [open, setOpen] = useState<Article | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/articles/refresh", { method: "POST" });
      const r = await fetch("/api/articles");
      if (r.ok) {
        const { articles: next } = (await r.json()) as { articles: Article[] };
        setArticles(next);
      }
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }

  // Lightweight pull-to-refresh: only engages at the top of the page.
  function onTouchStart(e: React.TouchEvent) {
    startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy * 0.5, PULL_THRESHOLD + 20));
  }
  function onTouchEnd() {
    if (pull >= PULL_THRESHOLD) refresh();
    else setPull(0);
    startY.current = null;
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden text-[12px] text-ink-3 transition-[height]"
        style={{ height: refreshing ? 28 : pull }}
      >
        {refreshing ? "Refreshing…" : pull >= PULL_THRESHOLD ? "Release to refresh" : pull > 0 ? "Pull to refresh" : ""}
      </div>

      {articles.length === 0 ? (
        <div className="mx-4 rounded-card glass-1 p-6 text-center">
          <p className="text-[15px] font-semibold text-ink">No articles yet</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Once your newsletter mailbox is connected, new issues appear here. Pull down to check now.
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="mt-4 min-h-[44px] rounded-pill bg-accent px-5 py-2.5 text-[14px] font-semibold text-bg active:scale-95 disabled:opacity-40"
          >
            {refreshing ? "Checking…" : "Check now"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 px-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} onOpen={() => setOpen(a)} />
          ))}
        </div>
      )}

      {open && <ArticleReader article={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
