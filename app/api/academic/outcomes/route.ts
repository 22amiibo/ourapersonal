import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

const VALID_ASSESSMENT_TYPES = ["exam", "assignment", "quiz", "presentation", "lab", "other"];

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { course, assessment_type, outcome_date, score, grade, notes } = body as Record<string, unknown>;

  if (typeof course !== "string" || !course.trim()) {
    return NextResponse.json({ ok: false, error: "course is required" }, { status: 400 });
  }
  if (typeof assessment_type !== "string" || !VALID_ASSESSMENT_TYPES.includes(assessment_type)) {
    return NextResponse.json({ ok: false, error: `assessment_type must be one of: ${VALID_ASSESSMENT_TYPES.join(", ")}` }, { status: 400 });
  }
  if (typeof outcome_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(outcome_date)) {
    return NextResponse.json({ ok: false, error: "outcome_date must be YYYY-MM-DD" }, { status: 400 });
  }

  const scoreVal = score !== undefined ? Number(score) : null;
  if (scoreVal !== null && (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100)) {
    return NextResponse.json({ ok: false, error: "score must be 0–100" }, { status: 400 });
  }

  const gradeVal = typeof grade === "string" && grade.trim() ? grade.trim() : null;
  const notesVal = typeof notes === "string" && notes.trim() ? notes.trim() : null;

  try {
    const rows = await sql`
      INSERT INTO outcomes (user_id, course, assessment_type, outcome_date, score, grade, notes)
      VALUES (${USER_ID}, ${course.trim()}, ${assessment_type}, ${outcome_date}, ${scoreVal}, ${gradeVal}, ${notesVal})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: (rows[0] as { id: number }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
