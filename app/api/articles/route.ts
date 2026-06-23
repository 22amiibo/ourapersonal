import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

// GET /api/articles — latest 5 articles for the user (newest first). No AI.
export async function GET() {
  try {
    const rows = await sql`
      SELECT a.id, a.title, a.image_url, a.description, a.body_html, a.published_at, a.original_url
      FROM articles a
      JOIN sources s ON s.id = a.source_id
      WHERE s.user_id = ${USER_ID}
      ORDER BY a.published_at DESC NULLS LAST, a.fetched_at DESC
      LIMIT 5
    `;
    return NextResponse.json({ articles: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
