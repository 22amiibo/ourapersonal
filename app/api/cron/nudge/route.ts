import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";
import { sendPushToUser } from "@/lib/push";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tz = await userTz();
    const today = localDateStr(tz);
    const results: Record<string, unknown> = {};

    // Check wind-down time setting
    const windDownRows = await sql`SELECT value FROM settings WHERE key = 'wind_down_time'`;
    const windDownTime = (windDownRows[0] as { value: string } | undefined)?.value ?? null;
    if (windDownTime) {
      const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      const currentHHMM = `${String(nowInTz.getHours()).padStart(2, "0")}:${String(nowInTz.getMinutes()).padStart(2, "0")}`;
      // Fire wind-down push if within 15 minutes of configured time
      const toMins = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
      };
      const diff = toMins(currentHHMM) - toMins(windDownTime);
      if (diff >= 0 && diff < 15) {
        await sendPushToUser(USER_ID, "Wind-down time", "Time to wind down — dim the lights and unplug for a better night's sleep.");
        results.windDown = "sent";
      }
    }

    const rows = await sql`
      SELECT COUNT(*)::int AS cnt FROM reflections
      WHERE user_id = ${USER_ID} AND to_char(entry_date, 'YYYY-MM-DD') = ${today}
    `;
    const count = (rows[0] as { cnt: number }).cnt;
    if (count > 0) return NextResponse.json({ ok: true, skipped: "already reflected", ...results });

    const dateRows = await sql`
      SELECT DISTINCT to_char(entry_date, 'YYYY-MM-DD') AS entry_date
      FROM reflections WHERE user_id = ${USER_ID} ORDER BY entry_date DESC LIMIT 30
    `;
    const dates = new Set(dateRows.map((d) => (d as { entry_date: string }).entry_date));

    const [y, m, dd] = today.split("-").map(Number);
    let streak = 0;
    let cursor = new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10);
    while (dates.has(cursor)) {
      streak++;
      const [cy, cm, cd] = cursor.split("-").map(Number);
      cursor = new Date(Date.UTC(cy, cm - 1, cd - 1)).toISOString().slice(0, 10);
    }

    const body = streak > 0
      ? `Don't break your ${streak}-day streak — reflect before bed.`
      : "How was your day? Take a moment to reflect.";

    await sendPushToUser(USER_ID, "Evening reflection", body, { url: "/reflect", tag: "evening-reflection" });
    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
