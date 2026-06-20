import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

// Reject an obviously-malformed connection string at startup. Otherwise a leftover
// placeholder (e.g. the `postgresql://user:password@host:port/database` line from
// .env.example) only fails at query time as an opaque "fetch failed".
function assertValidDatabaseUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL. It should look like " +
        "postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require",
    );
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(
      `DATABASE_URL must use the postgres:// or postgresql:// scheme (got "${parsed.protocol}").`,
    );
  }
  if (!parsed.username) {
    throw new Error(
      'DATABASE_URL is missing credentials (user:password before "@") — ' +
        "looks like a placeholder from .env.example.",
    );
  }
  if (
    ["host", "hostname", "ep-xxx", "ep-xxxx", ""].includes(parsed.hostname) ||
    !parsed.hostname.includes(".")
  ) {
    throw new Error(
      `DATABASE_URL host "${parsed.hostname}" looks like a placeholder, not a real ` +
        'Neon endpoint. Use the connection string from the Neon console "Connect" button.',
    );
  }
}

assertValidDatabaseUrl(url);

// Tagged-template SQL client.
// Example: const rows = await sql`SELECT * FROM reflections WHERE user_id = ${id}`;
export const sql = neon(url);
