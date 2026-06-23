import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

// GET /api/sources — list the user's content sources.
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, kind, identifier, active, created_at
      FROM sources WHERE user_id = ${USER_ID}
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ sources: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/sources — add a source. body: { name, kind: 'rss'|'email', identifier }
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, kind, identifier } = body as { name?: unknown; kind?: unknown; identifier?: unknown };

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (kind !== "rss" && kind !== "email") {
    return NextResponse.json({ error: "kind must be 'rss' or 'email'" }, { status: 400 });
  }
  if (typeof identifier !== "string" || !identifier.trim()) {
    return NextResponse.json({ error: "identifier is required" }, { status: 400 });
  }

  try {
    const rows = (await sql`
      INSERT INTO sources (user_id, name, kind, identifier, active)
      VALUES (${USER_ID}, ${name.trim()}, ${kind}, ${identifier.trim()}, TRUE)
      RETURNING id, name, kind, identifier, active, created_at
    `) as Record<string, unknown>[];
    return NextResponse.json({ source: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/sources — toggle active. body: { id, active }
export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, active } = body as { id?: unknown; active?: unknown };
  if (!Number.isInteger(id) || (id as number) <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }
  try {
    await sql`UPDATE sources SET active = ${active} WHERE id = ${id} AND user_id = ${USER_ID}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/sources?id=123 — remove a source (cascades its articles).
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }
  try {
    await sql`DELETE FROM sources WHERE id = ${id} AND user_id = ${USER_ID}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
