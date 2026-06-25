import Link from "next/link";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import ArticlesClient from "@/app/components/articles/ArticlesClient";
import type { Article } from "@/app/components/articles/types";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  let articles: Article[] = [];
  try {
    articles = (await sql`
      SELECT a.id, a.title, a.image_url, a.description, a.body_html, a.published_at, a.original_url
      FROM articles a
      JOIN sources s ON s.id = a.source_id
      WHERE s.user_id = ${USER_ID}
      ORDER BY a.published_at DESC NULLS LAST, a.fetched_at DESC
      LIMIT 5
    `) as Article[];
  } catch {
    // Tables not applied yet — render the empty state with a check-now button.
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-md overflow-x-clip pb-28 pt-5">
      <header className="flex items-center justify-between px-5 pb-3 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Articles</h1>
        <Link
          href="/settings/sources"
          className="text-[13px] font-semibold text-accent"
          aria-label="Manage sources"
        >
          Sources
        </Link>
      </header>

      <ArticlesClient initial={articles} />
    </main>
  );
}
