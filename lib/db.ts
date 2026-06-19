import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

// Tagged-template SQL client.
// Example: const rows = await sql`SELECT * FROM reflections WHERE user_id = ${id}`;
export const sql = neon(process.env.DATABASE_URL);
