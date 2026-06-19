import { NextResponse } from "next/server";
import { ouraAuthUrl } from "@/lib/oura";

export async function GET() {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const res = NextResponse.redirect(ouraAuthUrl(state));
  res.cookies.set("oura_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });
  return res;
}
