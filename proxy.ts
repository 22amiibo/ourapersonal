import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, isLegacySession } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;

  const ok = !!cookie && (verifySessionToken(cookie) || isLegacySession(cookie));

  if (!ok) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/reflect/:path*",
    "/settings/:path*",
    "/weekly/:path*",
    "/health/:path*",
    "/log/:path*",
    "/api/reflections/:path*",
    "/api/briefing/:path*",
    "/api/calendar/:path*",
    "/api/export/:path*",
    "/api/goals/:path*",
    "/api/log/:path*",
    "/api/settings/:path*",
    "/api/push/:path*",
  ],
};
