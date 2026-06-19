import { NextResponse } from "next/server";
import { runDailyJob } from "@/lib/jobs";

// Vercel Cron calls this once a day with an Authorization: Bearer <CRON_SECRET> header.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runDailyJob();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
