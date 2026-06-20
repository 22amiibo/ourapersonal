import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, checkPassword } from "@/lib/auth";

export async function POST(req: Request) {
  let typed = "";
  try {
    const body = await req.json();
    typed = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (!process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "DASHBOARD_PASSWORD is not set on the server" },
      { status: 500 }
    );
  }

  if (!checkPassword(typed)) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // lets http://localhost work in dev
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
