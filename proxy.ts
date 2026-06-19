// Next.js 16 renamed "middleware" to "proxy". This file replaces middleware.ts.
// DELETE your old middleware.ts after adding this.
//
// It does a lightweight check: is the session cookie present and correct?
// If not, bounce to /login. (Authoritative logic lives in the routes/pages.)

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionValue } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;

  let ok = false;
  try {
    ok = !!cookie && cookie === sessionValue();
  } catch {
    ok = false;
  }

  if (!ok) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Only these paths require login. (Oura + cron routes are intentionally excluded:
// the Oura callback comes from Oura with no cookie, and cron uses CRON_SECRET.)
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/reflect/:path*",
    "/settings/:path*",
    "/api/reflections/:path*",
    "/api/briefing/:path*",
    "/api/calendar/:path*",
  ],
};
