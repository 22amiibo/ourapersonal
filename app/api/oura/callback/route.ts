import { NextResponse } from "next/server";
import { exchangeCode, saveTokens } from "@/lib/oura";
import { USER_ID } from "@/lib/jobs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const appUrl = process.env.APP_URL || url.origin;

  const cookieState = req.headers.get("cookie")?.match(/oura_oauth_state=([^;]+)/)?.[1];

  if (error) return NextResponse.redirect(`${appUrl}/settings?oura=denied`);
  if (!code) return NextResponse.redirect(`${appUrl}/settings?oura=missing_code`);
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${appUrl}/settings?oura=bad_state`);
  }

  try {
    const tokens = await exchangeCode(code);
    await saveTokens(USER_ID, tokens);
    return NextResponse.redirect(`${appUrl}/settings?oura=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?oura=error`);
  }
}
