// Applies extra-schema.sql to the database in DATABASE_URL.
//
// The schema is fully idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN
// IF NOT EXISTS, ON CONFLICT DO NOTHING, CREATE OR REPLACE), so it is safe
// to run repeatedly. Statements run in file order so foreign-key references
// resolve. Each statement runs on its own; a failure is logged and the run
// continues so one unsupported statement can't block the rest.
//
//   node scripts/apply-extra-schema.mjs
//
// DATABASE_URL is read from the environment, falling back to .env.

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    const m = env.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (m) return m[1].trim();
  } catch {
    /* no .env */
  }
  return null;
}

const url = loadDatabaseUrl();
if (!url) {
  console.error("DATABASE_URL not found in environment or .env");
  process.exit(1);
}

const sql = neon(url);
const raw = readFileSync(new URL("../extra-schema.sql", import.meta.url), "utf8");

// Drop full-line comments, then split into statements on the terminating
// semicolon. No statement in this file contains an inline semicolon.
const cleaned = raw.replace(/^\s*--.*$/gm, "");
const statements = cleaned
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

let ok = 0;
const failures = [];

for (const stmt of statements) {
  const head = stmt.split("\n")[0].slice(0, 72);
  try {
    await sql.query(stmt);
    ok++;
    console.log(`  ok   ${head}`);
  } catch (e) {
    failures.push({ head, message: e.message });
    console.log(`  FAIL ${head}  ->  ${e.message}`);
  }
}

console.log(`\nApplied ${ok}/${statements.length} statements. ${failures.length} failed.`);
process.exit(failures.length > 0 ? 1 : 0);
