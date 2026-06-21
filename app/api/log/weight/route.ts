import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { weight_kg, note, log_date } = body as Record<string, unknown>;

  if (typeof weight_kg !== "number" || weight_kg <= 0 || weight_kg > 500) {
    return NextResponse.json({ ok: false, error: "weight_kg must be a positive number" }, { status: 400 });
  }

  const tz = await userTz();
  const dateVal = typeof log_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log_date)
    ? log_date
    : localDateStr(tz);

  const noteVal = typeof note === "string" && note.trim() ? note.trim() : null;

  try {
    const rows = await sql`
      INSERT INTO weight_logs (user_id, log_date, weight_kg, note)
      VALUES (${USER_ID}, ${dateVal}, ${weight_kg}, ${noteVal})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: (rows[0] as { id: number }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
