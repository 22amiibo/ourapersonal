-- Run this in the Neon SQL Editor AFTER the main schema.
-- It seeds your single user (id = 1) and adds a small settings table
-- used to store things like your calendar .ics URL.

INSERT INTO users (id, email, timezone)
VALUES (1, 'me@example.com', 'America/New_York')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Intake log (caffeine / alcohol / free-text notes). Mirrors the runtime
-- ensureTable() in app/api/log/intake/route.ts so the table can be created
-- up front instead of on every request.
CREATE TABLE IF NOT EXISTS intake_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  type       TEXT NOT NULL,
  quantity   NUMERIC NOT NULL DEFAULT 0,
  unit       TEXT NOT NULL DEFAULT '',
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note       TEXT
);
