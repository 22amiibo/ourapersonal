import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

const RP_NAME = "Briefing";
const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function GET() {
  const existingRows = await sql`
    SELECT credential_id FROM webauthn_credentials WHERE user_id = ${USER_ID}
  `;
  const existing = existingRows.map((r) => ({
    id: (r as { credential_id: string }).credential_id,
    type: "public-key" as const,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new Uint8Array([USER_ID]),
    userName: "user",
    userDisplayName: "Dashboard User",
    excludeCredentials: existing,
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  const res = NextResponse.json(options);
  res.cookies.set("webauthn_challenge", options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return res;
}
