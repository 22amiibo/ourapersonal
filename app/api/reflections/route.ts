import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { extractWithTool, MODEL } from "@/lib/anthropic";
import { reflectionExtractionTool } from "@/lib/prompts";
import { USER_ID } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";

function prevDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 100);

  const tzRows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  const tz = (tzRows[0] as { timezone?: string })?.timezone || "America/New_York";
  const today = localDateStr(tz);

  const reflections = await sql`
    SELECT r.id, to_char(r.entry_date, 'YYYY-MM-DD') AS entry_date, r.raw_text, m.confidence_level,
           o.readiness_score, o.sleep_score
    FROM reflections r
    LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
    LEFT JOIN oura_daily o ON o.user_id = r.user_id AND o.day = r.entry_date
    WHERE r.user_id = ${USER_ID}
    ORDER BY r.entry_date DESC
    LIMIT ${limit}
  `;

  const dateRows = await sql`
    SELECT DISTINCT to_char(entry_date, 'YYYY-MM-DD') AS entry_date
    FROM reflections
    WHERE user_id = ${USER_ID}
    ORDER BY entry_date DESC
    LIMIT 90
  `;
  const dates = new Set(dateRows.map((d) => (d as { entry_date: string }).entry_date));

  let streak = 0;
  let cursor = today;
  while (dates.has(cursor)) {
    streak++;
    cursor = prevDate(cursor);
  }

  return NextResponse.json({ reflections, streak });
}

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "Reflection is empty" }, { status: 400 });
  }

  const tzRows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
  const tz = (tzRows[0] as { timezone?: string })?.timezone || "America/New_York";
  const entryDate = localDateStr(tz);

  // 1) Always store the raw text first (immutable record).
  const inserted = await sql`
    INSERT INTO reflections (user_id, entry_date, raw_text)
    VALUES (${USER_ID}, ${entryDate}, ${text})
    RETURNING id
  `;
  const reflectionId = (inserted[0] as { id: number }).id;

  // 2) Extract metadata with Claude. Best-effort: the raw text is already saved,
  //    so if this fails we still keep the reflection and can re-extract later.
  try {
    const meta = await extractWithTool<{
      confidence_level: number;
      sentiment: number;
      accomplishments: string[];
      pending_work: string[];
      topics: string[];
      blockers: string[];
    }>({
      userText: `Extract metadata from this daily reflection:\n\n"""${text}"""`,
      tool: reflectionExtractionTool,
      maxTokens: 800,
    });

    await sql`
      INSERT INTO reflection_metadata
        (reflection_id, confidence_level, sentiment, accomplishments, pending_work, topics, blockers, model_version, extracted_at)
      VALUES (${reflectionId}, ${meta.confidence_level ?? null}, ${meta.sentiment ?? null},
              ${JSON.stringify(meta.accomplishments ?? [])}, ${JSON.stringify(meta.pending_work ?? [])},
              ${meta.topics ?? []}, ${JSON.stringify(meta.blockers ?? [])}, ${MODEL}, NOW())
      ON CONFLICT (reflection_id) DO UPDATE
        SET confidence_level = EXCLUDED.confidence_level, sentiment = EXCLUDED.sentiment,
            accomplishments = EXCLUDED.accomplishments, pending_work = EXCLUDED.pending_work,
            topics = EXCLUDED.topics, blockers = EXCLUDED.blockers,
            model_version = EXCLUDED.model_version, extracted_at = NOW()
    `;
    return NextResponse.json({ ok: true, extracted: true, metadata: meta });
  } catch (e) {
    return NextResponse.json({ ok: true, extracted: false, error: String(e) });
  }
}
