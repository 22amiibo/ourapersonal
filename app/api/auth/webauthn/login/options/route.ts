import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";

export async function GET() {
  const credRows = await sql`
    SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ${USER_ID}
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowCredentials = credRows.map((r: any) => ({
    id: r.credential_id as string,
    transports: r.transports ?? undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "preferred",
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
