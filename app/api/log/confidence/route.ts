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

  const { course, confidence_score, stress_score, notes, log_date } = body as Record<string, unknown>;

  if (typeof course !== "string" || !course.trim()) {
    return NextResponse.json({ ok: false, error: "course is required" }, { status: 400 });
  }

  const confVal = clampInt(confidence_score, 1, 10);
  const stressVal = clampInt(stress_score, 1, 10);

  if (confVal === null) return NextResponse.json({ ok: false, error: "confidence_score must be 1–10" }, { status: 400 });
  if (stressVal === null) return NextResponse.json({ ok: false, error: "stress_score must be 1–10" }, { status: 400 });

  const tz = await userTz();
  const dateVal = typeof log_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log_date)
    ? log_date
    : localDateStr(tz);

  const notesVal = typeof notes === "string" && notes.trim() ? notes.trim() : null;

  try {
    const rows = await sql`
      INSERT INTO confidence_logs (user_id, log_date, course, confidence_score, stress_score, notes)
      VALUES (${USER_ID}, ${dateVal}, ${course.trim()}, ${confVal}, ${stressVal}, ${notesVal})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: (rows[0] as { id: number }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
