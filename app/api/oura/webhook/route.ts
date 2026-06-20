import { NextResponse } from "next/server";
import crypto from "crypto";
import { syncOura } from "@/lib/oura";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr, daysAgoStr } from "@/lib/dates";

function verifySignature(body: string, sig: string | null): boolean {
  const secret = process.env.OURA_WEBHOOK_SECRET;
  if (!secret || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-oura-signature");

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const tz = await userTz();
    const today = localDateStr(tz);
    const weekAgo = daysAgoStr(tz, 3);
    await syncOura(USER_ID, { start: weekAgo, end: today });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Oura webhook verification handshake
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get("challenge");
  if (!challenge) return NextResponse.json({ error: "Missing challenge" }, { status: 400 });
  return NextResponse.json({ challenge });
}
