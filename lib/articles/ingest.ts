import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { sql } from "@/lib/db";
import { sanitizeArticleHtml, firstImageUrl, deriveDescription } from "./sanitize";

// userId is passed in (not imported from lib/jobs) to avoid a circular import,
// since lib/jobs imports this module for the daily cron.

// How many recent messages to scan per poll. Newsletters arrive ~daily, so a
// small window keeps polling cheap while comfortably catching new arrivals.
const SCAN_LIMIT = 25;

export type IngestResult = {
  scanned: number;
  inserted: number;
  skipped?: string;
};

function imapConfig() {
  const host = process.env.NEWSLETTER_IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.NEWSLETTER_IMAP_PORT || 993);
  const user = process.env.NEWSLETTER_IMAP_USER;
  // Accept NEWSLETTER_IMAP_PASSWORD (preferred) or the shorter _PASS alias.
  const pass = process.env.NEWSLETTER_IMAP_PASSWORD || process.env.NEWSLETTER_IMAP_PASS;
  if (!user || !pass) return null;
  return { host, port, secure: true, auth: { user, pass } };
}

// Get-or-create the single email source row for this mailbox.
async function ensureEmailSource(userId: number, identifier: string): Promise<number> {
  const existing = (await sql`
    SELECT id FROM sources
    WHERE user_id = ${userId} AND kind = 'email' AND identifier = ${identifier}
    LIMIT 1
  `) as { id: number }[];
  if (existing[0]) return existing[0].id;

  const inserted = (await sql`
    INSERT INTO sources (user_id, name, kind, identifier, active)
    VALUES (${userId}, ${"Newsletter mailbox"}, ${"email"}, ${identifier}, TRUE)
    RETURNING id
  `) as { id: number }[];
  return inserted[0].id;
}

/**
 * Poll the dedicated newsletter mailbox over IMAP, parse each recent message,
 * and insert new articles (deduped by Message-ID → guid). Zero AI tokens.
 *
 * No-ops gracefully when IMAP credentials are absent (e.g. before setup), so
 * the daily cron and pull-to-refresh never throw on a fresh install.
 */
export async function ingestEmail(userId = 1): Promise<IngestResult> {
  const cfg = imapConfig();
  if (!cfg) return { scanned: 0, inserted: 0, skipped: "no IMAP credentials" };

  const sourceId = await ensureEmailSource(userId, cfg.auth.user);
  const client = new ImapFlow({ ...cfg, logger: false });

  let scanned = 0;
  let inserted = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) return { scanned: 0, inserted: 0 };

      const start = Math.max(1, total - SCAN_LIMIT + 1);
      for await (const msg of client.fetch(`${start}:*`, { source: true })) {
        if (!msg.source) continue;
        scanned++;
        const parsed = await simpleParser(msg.source);

        const guid =
          parsed.messageId ||
          `${parsed.subject ?? "untitled"}|${parsed.date?.toISOString() ?? ""}`;
        const title = (parsed.subject ?? "Untitled").trim();
        const rawHtml = parsed.html || parsed.textAsHtml || "";
        const bodyHtml = sanitizeArticleHtml(rawHtml);
        const imageUrl = firstImageUrl(rawHtml);
        const description = deriveDescription(parsed.text, rawHtml);
        const publishedAt = parsed.date ? parsed.date.toISOString() : null;

        const res = (await sql`
          INSERT INTO articles
            (source_id, guid, title, image_url, description, body_html, published_at, original_url)
          VALUES
            (${sourceId}, ${guid}, ${title}, ${imageUrl}, ${description}, ${bodyHtml}, ${publishedAt}, ${null})
          ON CONFLICT (guid) DO NOTHING
          RETURNING id
        `) as { id: number }[];
        if (res.length > 0) inserted++;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { scanned, inserted };
}
