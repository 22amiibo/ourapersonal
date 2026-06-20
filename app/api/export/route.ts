import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";

  const [reflections, intake, oura, weekly, briefings] = await Promise.all([
    sql`
      SELECT r.id, to_char(r.entry_date, 'YYYY-MM-DD') AS entry_date, r.raw_text,
             m.confidence_level, m.sentiment, m.topics, m.accomplishments, m.pending_work, m.blockers
      FROM reflections r LEFT JOIN reflection_metadata m ON m.reflection_id = r.id
      WHERE r.user_id = ${USER_ID} ORDER BY r.entry_date DESC
    `,
    sql`SELECT id, type, quantity::float8, unit, timestamp, note FROM intake_log WHERE user_id = ${USER_ID} ORDER BY timestamp DESC`,
    sql`SELECT to_char(day,'YYYY-MM-DD') AS day, sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds FROM oura_daily WHERE user_id = ${USER_ID} ORDER BY day DESC`,
    sql`SELECT to_char(week_of,'YYYY-MM-DD') AS week_of, sleep_avg, readiness_avg, hrv_avg, resting_hr_avg, confidence_level, notable_note FROM weekly_patterns WHERE user_id = ${USER_ID} ORDER BY week_of DESC`,
    sql`SELECT briefing_date, summary_text, recommendations, generated_at FROM briefings WHERE user_id = ${USER_ID} ORDER BY briefing_date DESC`,
  ]);

  const data = { reflections, intake, oura, weekly, briefings };

  if (format === "csv") {
    const csvParts: string[] = [];

    function toCsv(label: string, rows: unknown[]) {
      if (!rows.length) return;
      const keys = Object.keys(rows[0] as object);
      csvParts.push(`### ${label}`);
      csvParts.push(keys.join(","));
      for (const row of rows) {
        csvParts.push(
          keys.map((k) => {
            const v = (row as Record<string, unknown>)[k];
            const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
            return s.includes(",") || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(",")
        );
      }
      csvParts.push("");
    }

    toCsv("reflections", reflections);
    toCsv("intake", intake);
    toCsv("oura_daily", oura);
    toCsv("weekly_patterns", weekly);
    toCsv("briefings", briefings);

    return new Response(csvParts.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="oura-export-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="oura-export-${new Date().toISOString().slice(0,10)}.json"`,
    },
  });
}
