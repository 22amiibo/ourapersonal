// Single-user auth — no accounts, no library.
// The session cookie value IS the AUTH_SECRET. It is httpOnly (never visible to
// client-side JS) and is compared on protected routes by the proxy. No hashing,
// no DB lookups — minimal moving parts.

export const SESSION_COOKIE = "oura_session";

export function sessionValue(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set in .env");
  return secret;
}

// Trims both sides so a stray space or carriage-return in .env can't break login.
export function checkPassword(typed: string): boolean {
  const expected = (process.env.DASHBOARD_PASSWORD ?? "").trim();
  return expected.length > 0 && typed.trim() === expected;
}
