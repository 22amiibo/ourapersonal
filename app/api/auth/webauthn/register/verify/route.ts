import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { cookies } from "next/headers";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const challenge = cookieStore.get("webauthn_challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "No challenge — request options first" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const credId = typeof credential.id === "string" ? credential.id : Buffer.from(credential.id as Uint8Array).toString("base64url");
    const pubKeyBytes = Buffer.from(credential.publicKey as Uint8Array);

    await sql`
      INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports, created_at)
      VALUES (${USER_ID}, ${credId}, ${pubKeyBytes}, ${credential.counter}, ${(body as { response?: { transports?: string[] } })?.response?.transports ?? null}, NOW())
      ON CONFLICT (credential_id) DO UPDATE SET counter = EXCLUDED.counter
    `;

    const token = createSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.delete("webauthn_challenge");
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
