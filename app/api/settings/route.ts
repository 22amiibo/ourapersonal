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
    const [userRows, settingsRows, ouraRows] = await Promise.all([
      sql`SELECT timezone FROM users WHERE id = ${USER_ID}`,
      sql`SELECT key, value FROM settings WHERE key IN ('wind_down_time')`,
      sql`SELECT 1 FROM integrations WHERE user_id = ${USER_ID} AND provider = 'oura' AND status = 'active' LIMIT 1`,
    ]);
    const timezone = (userRows[0] as { timezone?: string })?.timezone || "America/New_York";
    const settingsMap = Object.fromEntries(
      (settingsRows as { key: string; value: string }[]).map((r) => [r.key, r.value])
    );
    const ouraConnected = ouraRows.length > 0;
    return NextResponse.json({ timezone, wind_down_time: settingsMap.wind_down_time ?? null, ouraConnected });
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

  const b = body as { timezone?: unknown; wind_down_time?: unknown };

  if (b.timezone !== undefined) {
    if (typeof b.timezone !== "string" || !TIMEZONES.includes(b.timezone)) {
      return NextResponse.json({ error: "Unsupported timezone" }, { status: 400 });
    }
    try {
      await sql`UPDATE users SET timezone = ${b.timezone} WHERE id = ${USER_ID}`;
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (b.wind_down_time !== undefined) {
    if (b.wind_down_time === null) {
      try {
        await sql`DELETE FROM settings WHERE key = 'wind_down_time'`;
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
      }
    }
    if (typeof b.wind_down_time !== "string" || !/^\d{2}:\d{2}$/.test(b.wind_down_time)) {
      return NextResponse.json({ error: "wind_down_time must be HH:MM" }, { status: 400 });
    }
    try {
      await sql`
        INSERT INTO settings (key, value) VALUES ('wind_down_time', ${b.wind_down_time})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
