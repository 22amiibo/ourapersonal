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

-- =============================================================
-- Phase 1.1: Web Push subscriptions
-- =============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id    INTEGER NOT NULL,
  endpoint   TEXT PRIMARY KEY,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Phase 1.3: WebAuthn / passkey credentials
-- =============================================================
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  user_id       INTEGER NOT NULL,
  credential_id TEXT PRIMARY KEY,
  public_key    BYTEA NOT NULL,
  counter       BIGINT NOT NULL DEFAULT 0,
  transports    TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Phase 2.2: Reflection embeddings (requires pgvector)
-- Run first: CREATE EXTENSION IF NOT EXISTS vector;
-- =============================================================
-- CREATE TABLE IF NOT EXISTS reflection_embeddings (
--   reflection_id INTEGER PRIMARY KEY REFERENCES reflections(id) ON DELETE CASCADE,
--   embedding     vector(1024),
--   model         TEXT NOT NULL DEFAULT 'voyage-3',
--   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX ON reflection_embeddings USING hnsw (embedding vector_cosine_ops);

-- =============================================================
-- Phase 2.3: AI monthly narratives
-- =============================================================
CREATE TABLE IF NOT EXISTS narratives (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  month_of    DATE NOT NULL,
  narrative   TEXT NOT NULL,
  model_ver   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_of)
);

-- =============================================================
-- Phase 2.4: Goals / habits
-- =============================================================
CREATE TABLE IF NOT EXISTS goals (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  label       TEXT NOT NULL,
  target_json JSONB,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Phase 3.3: Performance views (no materialized view needed;
-- the daily job pre-computes correlation deltas via SQL)
-- =============================================================
CREATE OR REPLACE VIEW mv_daily_scores AS
SELECT user_id, day, sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds
FROM oura_daily;

-- =============================================================
-- Phase 4.1: Habit check-ins (daily goal completion tracking)
-- =============================================================
CREATE TABLE IF NOT EXISTS habit_completions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  goal_id        INTEGER NOT NULL,
  completed_date DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, goal_id, completed_date)
);
