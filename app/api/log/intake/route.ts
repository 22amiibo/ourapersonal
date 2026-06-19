import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

type IntakeType = "caffeine" | "alcohol" | "note";
const VALID_TYPES: IntakeType[] = ["caffeine", "alcohol", "note"];

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

  if (intakeType !== "note") {
    if (typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
    }
  }

  if (intakeType === "note") {
    if (typeof note !== "string" || !note.trim()) {
      return NextResponse.json({ error: "note text is required" }, { status: 400 });
    }
  }

  const qty = intakeType === "note" ? 0 : (quantity as number);

  const ts = timestamp ? new Date(timestamp as string) : new Date();
  if (isNaN(ts.getTime())) {
    return NextResponse.json({ error: "invalid timestamp" }, { status: 400 });
  }

  const unitVal =
    intakeType === "note"
      ? ""
      : typeof unit === "string" && unit.trim()
      ? unit.trim()
      : intakeType === "caffeine"
      ? "mg"
      : "drinks";

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
