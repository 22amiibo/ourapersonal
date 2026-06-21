import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) return null;
  return n;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { course, duration_minutes, method, session_date, confidence_before, confidence_after, notes } =
    body as Record<string, unknown>;

  if (typeof course !== "string" || !course.trim()) {
    return NextResponse.json({ ok: false, error: "course is required" }, { status: 400 });
  }

  const durationVal = Number(duration_minutes);
  if (!Number.isInteger(durationVal) || durationVal <= 0) {
    return NextResponse.json({ ok: false, error: "duration_minutes must be a positive integer" }, { status: 400 });
  }

  if (typeof method !== "string" || !method.trim()) {
    return NextResponse.json({ ok: false, error: "method is required" }, { status: 400 });
  }

  const tz = await userTz();
  const dateVal = typeof session_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(session_date)
    ? session_date
    : localDateStr(tz);

  const confBeforeVal = confidence_before !== undefined ? clampInt(confidence_before, 1, 10) : null;
  if (confidence_before !== undefined && confBeforeVal === null) {
    return NextResponse.json({ ok: false, error: "confidence_before must be 1–10" }, { status: 400 });
  }

  const confAfterVal = confidence_after !== undefined ? clampInt(confidence_after, 1, 10) : null;
  if (confidence_after !== undefined && confAfterVal === null) {
    return NextResponse.json({ ok: false, error: "confidence_after must be 1–10" }, { status: 400 });
  }

  const notesVal = typeof notes === "string" && notes.trim() ? notes.trim() : null;

  try {
    const rows = await sql`
      INSERT INTO study_sessions
        (user_id, session_date, course, duration_minutes, method, confidence_before, confidence_after, notes)
      VALUES (${USER_ID}, ${dateVal}, ${course.trim()}, ${durationVal}, ${method.trim()},
              ${confBeforeVal}, ${confAfterVal}, ${notesVal})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: (rows[0] as { id: number }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
