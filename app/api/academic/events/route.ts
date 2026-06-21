import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

const VALID_EVENT_TYPES = ["exam", "assignment", "quiz", "presentation", "lab", "other"];

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, course, event_type, to_char(event_date, 'YYYY-MM-DD') AS event_date,
             importance, expected_stress, created_at
      FROM academic_events
      WHERE user_id = ${USER_ID}
      ORDER BY event_date ASC
    `;
    return NextResponse.json({ events: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { course, event_type, event_date, importance, expected_stress } = body as Record<string, unknown>;

  if (typeof course !== "string" || !course.trim()) {
    return NextResponse.json({ ok: false, error: "course is required" }, { status: 400 });
  }
  if (typeof event_type !== "string" || !VALID_EVENT_TYPES.includes(event_type)) {
    return NextResponse.json({ ok: false, error: `event_type must be one of: ${VALID_EVENT_TYPES.join(", ")}` }, { status: 400 });
  }
  if (typeof event_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return NextResponse.json({ ok: false, error: "event_date must be YYYY-MM-DD" }, { status: 400 });
  }

  const importanceVal = importance !== undefined ? Number(importance) : null;
  if (importanceVal !== null && (!Number.isInteger(importanceVal) || importanceVal < 1 || importanceVal > 5)) {
    return NextResponse.json({ ok: false, error: "importance must be 1–5" }, { status: 400 });
  }

  const stressVal = expected_stress !== undefined ? Number(expected_stress) : null;
  if (stressVal !== null && (!Number.isInteger(stressVal) || stressVal < 1 || stressVal > 10)) {
    return NextResponse.json({ ok: false, error: "expected_stress must be 1–10" }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO academic_events (user_id, course, event_type, event_date, importance, expected_stress)
      VALUES (${USER_ID}, ${course.trim()}, ${event_type}, ${event_date}, ${importanceVal}, ${stressVal})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: (rows[0] as { id: number }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
