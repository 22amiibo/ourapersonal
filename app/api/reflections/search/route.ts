import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "voyage-3", input: [text] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data?.[0]?.embedding ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  // Try vector search first
  const embedding = await embedText(q);
  if (embedding) {
    try {
      const rows = await sql`
        SELECT r.id, to_char(r.entry_date, 'YYYY-MM-DD') AS entry_date, r.raw_text,
               m.confidence_level
        FROM reflection_embeddings re
        JOIN reflections r ON r.id = re.reflection_id
        LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
        WHERE r.user_id = ${USER_ID}
        ORDER BY re.embedding <=> ${JSON.stringify(embedding)}::vector
        LIMIT 5
      `;
      return NextResponse.json({ results: rows, method: "vector" });
    } catch {
      // pgvector not set up — fall through to full-text search
    }
  }

  // Full-text fallback
  const rows = await sql`
    SELECT r.id, to_char(r.entry_date, 'YYYY-MM-DD') AS entry_date, r.raw_text,
           m.confidence_level
    FROM reflections r LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
    WHERE r.user_id = ${USER_ID}
      AND (r.raw_text ILIKE ${"%" + q + "%"} OR m.topics::text ILIKE ${"%" + q + "%"})
    ORDER BY r.entry_date DESC
    LIMIT 10
  `;
  return NextResponse.json({ results: rows, method: "fulltext" });
}
