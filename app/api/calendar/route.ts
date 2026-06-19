import { NextResponse } from "next/server";
import { setCalendarUrl, syncCalendar } from "@/lib/calendar";
import { USER_ID } from "@/lib/jobs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string })?.action;

  if (action === "save") {
    const u = String((body as { url?: string })?.url ?? "").trim();
    if (!u.startsWith("http")) {
      return NextResponse.json({ ok: false, error: "That doesn't look like a URL" }, { status: 400 });
    }
    try {
      await setCalendarUrl(u);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }

  if (action === "sync") {
    try {
      const r = await syncCalendar(USER_ID);
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
