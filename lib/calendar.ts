import nodeIcal from "node-ical";
import { sql } from "@/lib/db";

// Free, no-AI classification by scanning the event title.
export function classifyEvent(title: string): "exam" | "assignment" | "event" {
  const t = title.toLowerCase();
  if (/\b(exam|midterm|final|finals|quiz|test)\b/.test(t)) return "exam";
  if (/\b(due|assignment|homework|hw|lab|essay|paper|project|problem set|pset)\b/.test(t)) {
    return "assignment";
  }
  return "event";
}

export async function getCalendarUrl(): Promise<string | null> {
  const rows = await sql`SELECT value FROM settings WHERE key = 'calendar_ics_url'`;
  return rows.length ? (rows[0] as { value: string }).value : null;
}

export async function setCalendarUrl(url: string) {
  await sql`
    INSERT INTO settings (key, value) VALUES ('calendar_ics_url', ${url})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function syncCalendar(userId: number) {
  const url = await getCalendarUrl();
  if (!url) return { synced: 0, skipped: "no calendar url" };

  const data = await nodeIcal.async.fromURL(url);
  let synced = 0;

  for (const k of Object.keys(data)) {
    const ev = (data as any)[k];
    if (!ev || ev.type !== "VEVENT") continue;

    const title = String(ev.summary ?? "Untitled");
    const externalId = String(ev.uid ?? `${title}-${ev.start}`);
    const startsAt = ev.start ? new Date(ev.start).toISOString() : null;
    const endsAt = ev.end ? new Date(ev.end).toISOString() : null;
    const kind = classifyEvent(title);

    await sql`
      INSERT INTO calendar_events
        (user_id, external_id, title, kind, starts_at, ends_at, raw_payload, synced_at)
      VALUES (${userId}, ${externalId}, ${title}, ${kind}, ${startsAt}, ${endsAt},
              ${JSON.stringify({ summary: title, location: ev.location ?? null })}, NOW())
      ON CONFLICT (user_id, external_id) DO UPDATE
        SET title = EXCLUDED.title, kind = EXCLUDED.kind,
            starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
            raw_payload = EXCLUDED.raw_payload, synced_at = NOW()
    `;
    synced++;
  }
  return { synced };
}
