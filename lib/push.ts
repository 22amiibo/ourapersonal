import webpush from "web-push";
import { sql } from "@/lib/db";

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

export async function sendPushToUser(userId: number, title: string, body: string) {
  if (!ensureConfigured()) return;
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
