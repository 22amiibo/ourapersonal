import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

const VALID_KINDS = [
  "sleep_hours_gte",
  "reflect_daily",
  "caffeine_before_hour",
  "alcohol_free_days_per_week",
  "readiness_gte",
] as const;

type GoalKind = (typeof VALID_KINDS)[number];

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, kind, label, target_json, active, created_at
      FROM goals WHERE user_id = ${USER_ID} AND active = TRUE ORDER BY created_at ASC
    `;
    return NextResponse.json({ goals: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { kind, label, target_json } = body as { kind?: unknown; label?: unknown; target_json?: unknown };

  if (!VALID_KINDS.includes(kind as GoalKind)) {
    return NextResponse.json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` }, { status: 400 });
  }
  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO goals (user_id, kind, label, target_json, active, created_at)
      VALUES (${USER_ID}, ${kind as string}, ${label.trim()}, ${target_json ? JSON.stringify(target_json) : null}, TRUE, NOW())
      RETURNING id, kind, label, target_json, active, created_at
    `;
    return NextResponse.json({ ok: true, goal: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }
  try {
    await sql`UPDATE goals SET active = FALSE WHERE id = ${id} AND user_id = ${USER_ID}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
