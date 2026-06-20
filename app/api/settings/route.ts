import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

// Hardcoded allowlist of IANA timezones offered in the settings picker.
export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export async function GET() {
  try {
    const rows = await sql`SELECT timezone FROM users WHERE id = ${USER_ID}`;
    const timezone = (rows[0] as { timezone?: string })?.timezone || "America/New_York";
    return NextResponse.json({ timezone });
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

  const timezone = (body as { timezone?: unknown })?.timezone;
  if (typeof timezone !== "string" || !TIMEZONES.includes(timezone)) {
    return NextResponse.json({ error: "Unsupported timezone" }, { status: 400 });
  }

  try {
    await sql`UPDATE users SET timezone = ${timezone} WHERE id = ${USER_ID}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
