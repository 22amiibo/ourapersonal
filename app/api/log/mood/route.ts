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

  const { mood, energy, stress, note, log_date } = body as Record<string, unknown>;

  const moodVal = clampInt(mood, 1, 10);
  const energyVal = clampInt(energy, 1, 10);
  const stressVal = clampInt(stress, 1, 10);

  if (moodVal === null) return NextResponse.json({ ok: false, error: "mood must be 1–10" }, { status: 400 });
  if (energyVal === null) return NextResponse.json({ ok: false, error: "energy must be 1–10" }, { status: 400 });
  if (stressVal === null) return NextResponse.json({ ok: false, error: "stress must be 1–10" }, { status: 400 });

  const tz = await userTz();
  const dateVal = typeof log_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log_date)
    ? log_date
    : localDateStr(tz);

  const noteVal = typeof note === "string" && note.trim() ? note.trim() : null;

  try {
    const rows = await sql`
      INSERT INTO mood_logs (user_id, log_date, mood, energy, stress, note)
      VALUES (${USER_ID}, ${dateVal}, ${moodVal}, ${energyVal}, ${stressVal}, ${noteVal})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: (rows[0] as { id: number }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
