import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
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

  const credId = (body as { id?: string }).id;
  if (!credId) return NextResponse.json({ error: "Missing credential id" }, { status: 400 });

  const credRows = await sql`
    SELECT credential_id, public_key, counter
    FROM webauthn_credentials WHERE credential_id = ${credId} AND user_id = ${USER_ID}
  `;
  if (!credRows.length) return NextResponse.json({ error: "Credential not found" }, { status: 404 });

  const cred = credRows[0] as { credential_id: string; public_key: Buffer; counter: number };

  try {
    const verification = await verifyAuthenticationResponse({
      response: body as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(cred.public_key),
        counter: cred.counter,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    await sql`
      UPDATE webauthn_credentials SET counter = ${verification.authenticationInfo.newCounter}
      WHERE credential_id = ${credId} AND user_id = ${USER_ID}
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
