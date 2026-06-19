import { NextResponse } from "next/server";
import { runDailyJob } from "@/lib/jobs";

// Protected by proxy.ts (login). Lets you run the whole daily job on demand
// from the dashboard button — handy for testing before the cron exists.
export async function POST() {
  try {
    const results = await runDailyJob();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
