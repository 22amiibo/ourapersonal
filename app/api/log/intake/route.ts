import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { insertIntakeEntry } from "@/lib/intake";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const tz = await userTz();
    const entries = await sql`
      SELECT id, type, quantity::float8, unit, timestamp, note
      FROM intake_log
      WHERE user_id = ${USER_ID}
        AND DATE(timestamp AT TIME ZONE ${tz}) = ${date}::date
      ORDER BY timestamp DESC
    `;
    return NextResponse.json({ entries });
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
    await sql`DELETE FROM intake_log WHERE id = ${id} AND user_id = ${USER_ID}`;
    return NextResponse.json({ ok: true });
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

  const result = await insertIntakeEntry(body as Parameters<typeof insertIntakeEntry>[0]);
  if (result.status === 201) {
    return NextResponse.json({ entry: result.entry }, { status: 201 });
  }
  return NextResponse.json({ error: result.error }, { status: result.status });
}
