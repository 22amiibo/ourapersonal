import webpush from "web-push";
import { sql } from "@/lib/db";
import { inQuietHours } from "@/lib/notify-timing";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
  return true;
}

// `opts.respectQuietHours` (with `opts.tz`) holds the push when it's the middle
// of the user's night — smart timing on top of a fixed cron. Omitting opts keeps
// the original always-send behavior, so existing callers are unaffected.
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  opts?: { respectQuietHours?: boolean; tz?: string },
) {
  if (!ensureConfigured()) return;
  if (opts?.respectQuietHours && opts.tz && inQuietHours(opts.tz)) return;
  const subs = await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `;
  for (const row of subs) {
    const s = row as { endpoint: string; p256dh: string; auth: string };
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body }),
      );
    } catch (e: unknown) {
      if ((e as { statusCode?: number }).statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
      }
    }
  }
}
