import { sql } from "@/lib/db";
import { USER_ID, userTz } from "@/lib/jobs";
import { localDateStr } from "@/lib/dates";
import LogTab, { type IntakeEntry } from "./LogTab";

export default async function LogPage() {
  const tz = await userTz();
  const today = localDateStr(tz);

  let entries: IntakeEntry[] = [];
  try {
    const rows = await sql`
      SELECT id, type, quantity::float8, unit, timestamp, note
      FROM intake_log
      WHERE user_id = ${USER_ID}
        AND DATE(timestamp AT TIME ZONE ${tz}) = ${today}::date
      ORDER BY timestamp DESC
    `;
    entries = rows as IntakeEntry[];
  } catch {
    // Table doesn't exist yet; the first POST to /api/log/intake will create it
  }

  return <LogTab initialEntries={entries} />;
}
