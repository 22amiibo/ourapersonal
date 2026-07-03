import { NextResponse } from "next/server";
import { USER_ID } from "@/lib/jobs";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const sent = await sendPushToUser(
    USER_ID,
    "Test notification",
    "This is a test push from Briefing.",
    { url: "/dashboard", tag: "test-push" },
  );
  if (sent === 0) {
    return NextResponse.json(
      { ok: false, error: "No active subscriptions, or VAPID keys not configured on the server." },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true, sent });
}
