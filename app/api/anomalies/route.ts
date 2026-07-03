import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

// Anomalies are detected daily by advanceAnomalies() (lib/pipeline/patterns.ts).
// This route only surfaces them and lets the user attach a context note, which
// generateBriefing() then feeds back to the AI as bounded extra context.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days") ?? 30), 1), 180);

  try {
    const rows = await sql`
      SELECT id, to_char(event_date, 'YYYY-MM-DD') AS event_date, metric, life_area,
             severity, direction, z_score::float8, user_note
      FROM anomaly_events
      WHERE user_id = ${USER_ID}
        AND event_date >= CURRENT_DATE - (${days} || ' days')::interval
      ORDER BY event_date DESC
      LIMIT 50
    `;
    return NextResponse.json({ anomalies: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, note } = body as { id?: unknown; note?: unknown };
  if (!Number.isInteger(id) || (id as number) <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }
  if (typeof note !== "string" || note.length > 500) {
    return NextResponse.json({ error: "note must be a string of at most 500 chars" }, { status: 400 });
  }

  try {
    const rows = await sql`
      UPDATE anomaly_events
      SET user_note = ${note.trim() || null}, note_added_at = NOW()
      WHERE id = ${id} AND user_id = ${USER_ID}
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
