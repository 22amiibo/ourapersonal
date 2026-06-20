import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";

type IntakeType = "caffeine" | "alcohol" | "note" | "mood" | "workout" | "weight" | "meal";
const VALID_TYPES: IntakeType[] = ["caffeine", "alcohol", "note", "mood", "workout", "weight", "meal"];

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS intake_log (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      type       TEXT NOT NULL,
      quantity   NUMERIC NOT NULL DEFAULT 0,
      unit       TEXT NOT NULL DEFAULT '',
      timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      note       TEXT
    )
  `;
  // Migration: drop old CHECK constraint that excluded 'note' type
  await sql`ALTER TABLE intake_log DROP CONSTRAINT IF EXISTS intake_log_type_check`;
}

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

  const { type, quantity, unit, timestamp, note } = body as {
    type?: unknown;
    quantity?: unknown;
    unit?: unknown;
    timestamp?: unknown;
    note?: unknown;
  };

  if (!VALID_TYPES.includes(type as IntakeType)) {
    return NextResponse.json({ error: "type must be caffeine, alcohol, or note" }, { status: 400 });
  }

  const intakeType = type as IntakeType;

  const quantityOptional: IntakeType[] = ["note", "mood", "workout", "meal"];
  if (!quantityOptional.includes(intakeType)) {
    if (typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
    }
  }

  if (intakeType === "note" && (typeof note !== "string" || !note.trim())) {
    return NextResponse.json({ error: "note text is required" }, { status: 400 });
  }

  const quantityOptional2: IntakeType[] = ["note", "mood", "workout", "meal"];
  const qty = quantityOptional2.includes(intakeType) ? (typeof quantity === "number" ? quantity : 0) : (quantity as number);

  const ts = timestamp ? new Date(timestamp as string) : new Date();
  if (isNaN(ts.getTime())) {
    return NextResponse.json({ error: "invalid timestamp" }, { status: 400 });
  }

  const defaultUnit: Partial<Record<IntakeType, string>> = {
    caffeine: "mg", alcohol: "drinks", weight: "kg", workout: "min",
  };
  const unitVal =
    typeof unit === "string" && unit.trim()
      ? unit.trim()
      : defaultUnit[intakeType] ?? "";

  let rows;
  try {
    await ensureTable();

    rows = await sql`
      INSERT INTO intake_log (user_id, type, quantity, unit, timestamp, note)
      VALUES (
        ${USER_ID},
        ${intakeType},
        ${qty},
        ${unitVal},
        ${ts.toISOString()},
        ${typeof note === "string" && note.trim() ? note.trim() : null}
      )
      RETURNING id, type, quantity::float8, unit, timestamp, note
    `;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  const aiUrl = process.env.AI_ANALYSIS_URL;
  if (aiUrl) {
    const aiKey = process.env.AI_ANALYSIS_API_KEY;
    fetch(aiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(aiKey ? { Authorization: `Bearer ${aiKey}` } : {}),
      },
      body: JSON.stringify({
        user_id: USER_ID,
        type: intakeType,
        quantity: qty,
        unit: unitVal,
        timestamp: ts.toISOString(),
        note: typeof note === "string" ? note.trim() : null,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ entry: rows[0] }, { status: 201 });
}
