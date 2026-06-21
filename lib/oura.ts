import { sql } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

const AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const API = "https://api.ouraring.com/v2";
const SCOPES = "personal daily heartrate spo2";

export function ouraAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.OURA_CLIENT_ID || "",
    redirect_uri: process.env.OURA_REDIRECT_URI || "",
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.OURA_REDIRECT_URI || "",
    client_id: process.env.OURA_CLIENT_ID || "",
    client_secret: process.env.OURA_CLIENT_SECRET || "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Oura token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refresh(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.OURA_CLIENT_ID || "",
    client_secret: process.env.OURA_CLIENT_SECRET || "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Oura token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function saveTokens(userId: number, t: TokenResponse) {
  const expiresAt = new Date(Date.now() + (t.expires_in ?? 86400) * 1000).toISOString();
  await sql`
    INSERT INTO integrations (user_id, provider, access_token_enc, refresh_token_enc, expires_at, scope, status)
    VALUES (${userId}, 'oura', ${encrypt(t.access_token)}, ${encrypt(t.refresh_token)}, ${expiresAt}, ${SCOPES}, 'active')
    ON CONFLICT (user_id, provider) DO UPDATE
      SET access_token_enc = EXCLUDED.access_token_enc,
          refresh_token_enc = EXCLUDED.refresh_token_enc,
          expires_at = EXCLUDED.expires_at,
          scope = EXCLUDED.scope,
          status = 'active'
  `;
}

export async function isConnected(userId: number): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM integrations WHERE user_id = ${userId} AND provider = 'oura'`;
  return rows.length > 0;
}

async function getValidAccessToken(userId: number): Promise<string | null> {
  const rows = await sql`
    SELECT access_token_enc, refresh_token_enc, expires_at
    FROM integrations WHERE user_id = ${userId} AND provider = 'oura'
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as { access_token_enc: string; refresh_token_enc: string; expires_at: string | null };
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;

  // Refresh if expiring within 5 minutes.
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const t = await refresh(decrypt(row.refresh_token_enc));
    await saveTokens(userId, t);
    return t.access_token;
  }
  return decrypt(row.access_token_enc);
}

async function getCollection(token: string, path: string, start: string, end: string): Promise<any[]> {
  const url = `${API}/usercollection/${path}?start_date=${start}&end_date=${end}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Oura ${path} failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data ?? [];
}

// Pull data for [start, end] (YYYY-MM-DD) and upsert one row per day.
export async function syncOura(userId: number, range: { start: string; end: string }) {
  const token = await getValidAccessToken(userId);
  if (!token) return { synced: 0, skipped: "not connected" };

  const { start, end } = range;
  const [dailySleep, dailyReadiness, dailyActivity, sleepDetail] = await Promise.all([
    getCollection(token, "daily_sleep", start, end),
    getCollection(token, "daily_readiness", start, end),
    getCollection(token, "daily_activity", start, end),
    getCollection(token, "sleep", start, end),
  ]);

  const byDay: Record<string, any> = {};
  const ensure = (d: string) => (byDay[d] ??= { day: d });

  for (const r of dailySleep) if (r.day) ensure(r.day).sleep_score = r.score ?? null;
  for (const r of dailyReadiness) {
    if (!r.day) continue;
    ensure(r.day).readiness_score = r.score ?? null;
    if (r.contributors && typeof r.contributors === "object") {
      ensure(r.day).readiness_contributors = r.contributors;
    }
    if (typeof r.temperature_deviation === "number") {
      ensure(r.day).temperature_deviation = r.temperature_deviation;
    }
  }
  for (const r of dailyActivity) {
    if (!r.day) continue;
    ensure(r.day).activity_score = r.score ?? null;
    if (typeof r.steps === "number") ensure(r.day).steps = r.steps;
    if (typeof r.active_calories === "number") ensure(r.day).active_calories = r.active_calories;
  }

  // The detailed `sleep` endpoint can return naps too — keep the longest period per day.
  for (const r of sleepDetail) {
    if (!r.day) continue;
    const e = ensure(r.day);
    const len = r.total_sleep_duration ?? 0;
    if (len >= (e._sleepLen ?? 0)) {
      e._sleepLen = len;
      e.hrv_avg = r.average_hrv ?? null;
      e.resting_hr = r.lowest_heart_rate ?? null;
      e.total_sleep_seconds = r.total_sleep_duration ?? null;
      e.rem_sleep_seconds = r.rem_sleep_duration ?? null;
      e.deep_sleep_seconds = r.deep_sleep_duration ?? null;
      e.light_sleep_seconds = r.light_sleep_duration ?? null;
      e.awake_seconds = r.awake_time ?? null;
      if (typeof r.temperature_deviation === "number" && e.temperature_deviation == null) {
        e.temperature_deviation = r.temperature_deviation;
      }
    }
  }

  let synced = 0;
  for (const day of Object.keys(byDay)) {
    const e = byDay[day];
    await sql`
      INSERT INTO oura_daily
        (user_id, day, sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds, raw_payload, synced_at)
      VALUES (${userId}, ${day}, ${e.sleep_score ?? null}, ${e.readiness_score ?? null},
              ${e.hrv_avg ?? null}, ${e.resting_hr ?? null}, ${e.total_sleep_seconds ?? null},
              ${JSON.stringify(e)}, NOW())
      ON CONFLICT (user_id, day) DO UPDATE
        SET sleep_score = EXCLUDED.sleep_score,
            readiness_score = EXCLUDED.readiness_score,
            hrv_avg = EXCLUDED.hrv_avg,
            resting_hr = EXCLUDED.resting_hr,
            total_sleep_seconds = EXCLUDED.total_sleep_seconds,
            raw_payload = EXCLUDED.raw_payload,
            synced_at = NOW()
    `;
    synced++;
  }
  await sql`UPDATE integrations SET last_synced_at = NOW() WHERE user_id = ${userId} AND provider = 'oura'`;
  return { synced };
}
