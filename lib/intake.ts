import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

// Shared intake-log insert used by /api/log/intake (cookie-gated) and
// /api/quicklog (Bearer-token, for iOS Shortcuts). Validation and the insert
// live here so both routes stay thin and identical in behavior.

export type IntakeType = "caffeine" | "alcohol" | "note" | "mood" | "workout" | "weight" | "meal";
export const VALID_INTAKE_TYPES: IntakeType[] = ["caffeine", "alcohol", "note", "mood", "workout", "weight", "meal"];

const QUANTITY_OPTIONAL: IntakeType[] = ["note", "mood", "workout", "meal"];

const DEFAULT_UNIT: Partial<Record<IntakeType, string>> = {
  caffeine: "mg", alcohol: "drinks", weight: "kg", workout: "min",
};

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

export type IntakeInput = {
  type?: unknown;
  quantity?: unknown;
  unit?: unknown;
  timestamp?: unknown;
  note?: unknown;
};

export type IntakeResult =
  | { status: 201; entry: unknown }
  | { status: 400 | 500; error: string };

export async function insertIntakeEntry(input: IntakeInput): Promise<IntakeResult> {
  const { type, quantity, unit, timestamp, note } = input;

  if (!VALID_INTAKE_TYPES.includes(type as IntakeType)) {
    return { status: 400, error: "type must be caffeine, alcohol, or note" };
  }
  const intakeType = type as IntakeType;

  if (!QUANTITY_OPTIONAL.includes(intakeType)) {
    if (typeof quantity !== "number" || quantity <= 0) {
      return { status: 400, error: "quantity must be a positive number" };
    }
  }

  if (intakeType === "note" && (typeof note !== "string" || !note.trim())) {
    return { status: 400, error: "note text is required" };
  }

  const qty = QUANTITY_OPTIONAL.includes(intakeType)
    ? (typeof quantity === "number" ? quantity : 0)
    : (quantity as number);

  const ts = timestamp ? new Date(timestamp as string) : new Date();
  if (isNaN(ts.getTime())) {
    return { status: 400, error: "invalid timestamp" };
  }

  const unitVal =
    typeof unit === "string" && unit.trim()
      ? unit.trim()
      : DEFAULT_UNIT[intakeType] ?? "";

  const noteVal = typeof note === "string" && note.trim() ? note.trim() : null;

  let rows;
  try {
    await ensureTable();
    rows = await sql`
      INSERT INTO intake_log (user_id, type, quantity, unit, timestamp, note)
      VALUES (${USER_ID}, ${intakeType}, ${qty}, ${unitVal}, ${ts.toISOString()}, ${noteVal})
      RETURNING id, type, quantity::float8, unit, timestamp, note
    `;
  } catch (e) {
    return { status: 500, error: String(e) };
  }

  // Optional fire-and-forget analysis hook — preserved from the original route.
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
        note: noteVal,
      }),
    }).catch(() => {});
  }

  return { status: 201, entry: rows[0] };
}
