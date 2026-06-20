import crypto from "crypto";

export const SESSION_COOKIE = "oura_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set in .env");
  return s;
}

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return false;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Date.now() < exp;
  } catch {
    return false;
  }
}

// Legacy: still used to verify the old cookie format (value === AUTH_SECRET)
// so existing sessions keep working without a forced re-login.
export function isLegacySession(cookie: string): boolean {
  try {
    return cookie === getSecret();
  } catch {
    return false;
  }
}

export function checkPassword(typed: string): boolean {
  const expected = (process.env.DASHBOARD_PASSWORD ?? "").trim();
  return expected.length > 0 && typed.trim() === expected;
}
