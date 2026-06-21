import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS habit_completions (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL,
      goal_id        INTEGER NOT NULL,
      completed_date DATE NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, goal_id, completed_date)
    )
  `;
}

export async function GET() {
  try {
    await ensureTable();
    const tz = await userTz();
    const today = localDateStr(tz);
    const goals = await sql`
      SELECT id, label FROM goals
      WHERE user_id = ${USER_ID} AND active = TRUE
      ORDER BY id
    `;
    const completions = await sql`
      SELECT goal_id FROM habit_completions
      WHERE user_id = ${USER_ID} AND completed_date = ${today}::date
    `;
    return NextResponse.json({
      goals,
      completed: (completions as { goal_id: number }[]).map((r) => r.goal_id),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const tz = await userTz();
    const today = localDateStr(tz);
    const { goal_id } = (await req.json()) as { goal_id: number };
    if (!goal_id) return NextResponse.json({ error: "goal_id required" }, { status: 400 });
    await sql`
      INSERT INTO habit_completions (user_id, goal_id, completed_date)
      VALUES (${USER_ID}, ${goal_id}, ${today}::date)
      ON CONFLICT (user_id, goal_id, completed_date) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const tz = await userTz();
    const today = localDateStr(tz);
    const goal_id = new URL(req.url).searchParams.get("goal_id");
    if (!goal_id) return NextResponse.json({ error: "goal_id required" }, { status: 400 });
    await sql`
      DELETE FROM habit_completions
      WHERE user_id = ${USER_ID}
        AND goal_id = ${Number(goal_id)}
        AND completed_date = ${today}::date
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
