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

-- =============================================================
-- Personal Intelligence System — schema additions
-- =============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- -------------------------------------------------------------
-- Layer 1 — new raw event tables (append-only, permanent)
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mood_logs (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL,
  log_date  DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mood      SMALLINT CHECK (mood BETWEEN 1 AND 10),
  energy    SMALLINT CHECK (energy BETWEEN 1 AND 10),
  stress    SMALLINT CHECK (stress BETWEEN 1 AND 10),
  note      TEXT
);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs (user_id, log_date);

CREATE TABLE IF NOT EXISTS weight_logs (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL,
  log_date  DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight_kg NUMERIC(5,2) NOT NULL,
  note      TEXT
);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs (user_id, log_date);

CREATE TABLE IF NOT EXISTS academic_events (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  course          TEXT NOT NULL,
  event_type      TEXT NOT NULL,  -- 'exam'|'quiz'|'midterm'|'presentation'|'due_date'
  event_date      DATE NOT NULL,
  importance      SMALLINT CHECK (importance BETWEEN 1 AND 5),
  expected_stress SMALLINT CHECK (expected_stress BETWEEN 1 AND 10),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academic_events_user_date ON academic_events (user_id, event_date);

CREATE TABLE IF NOT EXISTS confidence_logs (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  log_date         DATE NOT NULL,
  course           TEXT NOT NULL,
  confidence_score SMALLINT CHECK (confidence_score BETWEEN 1 AND 10),
  stress_score     SMALLINT CHECK (stress_score BETWEEN 1 AND 10),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_confidence_logs_user_date ON confidence_logs (user_id, log_date);

CREATE TABLE IF NOT EXISTS outcomes (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  outcome_date    DATE NOT NULL,
  course          TEXT NOT NULL,
  assessment_type TEXT NOT NULL,
  score           NUMERIC(5,2),
  grade           TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_user_date ON outcomes (user_id, outcome_date);

CREATE TABLE IF NOT EXISTS study_sessions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  session_date      DATE NOT NULL,
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  course            TEXT NOT NULL,
  duration_minutes  INTEGER NOT NULL,
  method            TEXT NOT NULL,
  confidence_before SMALLINT CHECK (confidence_before BETWEEN 1 AND 10),
  confidence_after  SMALLINT CHECK (confidence_after BETWEEN 1 AND 10),
  notes             TEXT
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions (user_id, session_date);

-- -------------------------------------------------------------
-- Layer 2 — extracted facts
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_facts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  fact_date   DATE NOT NULL,
  fact_type   TEXT NOT NULL,
  source      TEXT NOT NULL,
  life_area   TEXT NOT NULL,
  value_num   NUMERIC,
  value_text  TEXT,
  confidence  NUMERIC NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_facts_user_date ON daily_facts (user_id, fact_date);
CREATE INDEX IF NOT EXISTS idx_daily_facts_user_type ON daily_facts (user_id, fact_type);
CREATE INDEX IF NOT EXISTS idx_daily_facts_user_area_date ON daily_facts (user_id, life_area, fact_date DESC);

-- -------------------------------------------------------------
-- Feature vectors
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_feature_vectors (
  user_id              INTEGER NOT NULL,
  vector_date          DATE NOT NULL,
  sleep_hours          NUMERIC(4,2),
  readiness            NUMERIC(5,2),
  hrv                  NUMERIC(5,2),
  resting_hr           NUMERIC(5,2),
  activity_score       NUMERIC(5,2),
  steps                INTEGER,
  caffeine_mg          NUMERIC(7,2),
  alcohol_drinks       NUMERIC(4,2),
  workout_count        SMALLINT,
  mood_score           NUMERIC(4,2),
  stress_score         NUMERIC(4,2),
  confidence_score     NUMERIC(4,2),
  energy_score         NUMERIC(4,2),
  sleep_debt_7d        NUMERIC(5,2),
  readiness_delta      NUMERIC(5,2),
  hrv_delta            NUMERIC(5,2),
  health_score         NUMERIC(5,2),
  focus_score          NUMERIC(5,2),
  recovery_score       NUMERIC(5,2),
  academic_readiness   NUMERIC(5,2),
  PRIMARY KEY (user_id, vector_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_feature_vectors_user_date
  ON daily_feature_vectors (user_id, vector_date DESC);

-- -------------------------------------------------------------
-- Layer 3 — daily summaries
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_summaries (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  summary_date    DATE NOT NULL,
  summary_text    TEXT NOT NULL,
  key_events      TEXT[],
  top_insights    TEXT[],
  life_area       TEXT,
  scores          JSONB,
  health_score    NUMERIC(5,2),
  focus_score     NUMERIC(5,2),
  energy_score    NUMERIC(5,2),
  recovery_score  NUMERIC(5,2),
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, summary_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_embedding
  ON daily_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date
  ON daily_summaries (user_id, summary_date DESC);

-- -------------------------------------------------------------
-- Layer 4 — weekly summaries
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  week_of           DATE NOT NULL,
  summary_text      TEXT NOT NULL,
  positive_patterns TEXT[],
  negative_patterns TEXT[],
  recommendations   TEXT[],
  focus_trends      TEXT[],
  energy_trends     TEXT[],
  academic_trends   TEXT[],
  life_area         TEXT,
  scores            JSONB NOT NULL,
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_of)
);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_embedding
  ON weekly_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week
  ON weekly_summaries (user_id, week_of DESC);

-- -------------------------------------------------------------
-- Layer 5 — monthly summaries
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_summaries (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  month_of         DATE NOT NULL,
  narrative        TEXT NOT NULL,
  major_trends     TEXT[],
  recurring_themes TEXT[],
  predictions      TEXT[],
  life_area        TEXT,
  scores           JSONB NOT NULL,
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_of)
);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_embedding
  ON monthly_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_user_month
  ON monthly_summaries (user_id, month_of DESC);

-- -------------------------------------------------------------
-- Layer 6 — insight records
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insights (
  id                        SERIAL PRIMARY KEY,
  user_id                   INTEGER NOT NULL,
  insight_key               TEXT NOT NULL,
  category                  TEXT NOT NULL,
  life_area                 TEXT NOT NULL,
  claim                     TEXT NOT NULL,
  explanation               TEXT,
  evidence_summary          TEXT,
  evidence_count            INTEGER NOT NULL DEFAULT 0,
  confidence                NUMERIC NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  supporting_metrics        JSONB,
  counterfactual_support    TEXT,
  status                    TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'weakening', 'archived', 'conflict')),
  first_detected            DATE NOT NULL,
  last_confirmed            DATE,
  last_evaluated            DATE,
  decay_score               NUMERIC NOT NULL DEFAULT 1.0,
  predictive_accuracy_factor NUMERIC NOT NULL DEFAULT 1.0,
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, insight_key)
);
CREATE INDEX IF NOT EXISTS idx_insights_embedding
  ON insights USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_insights_user_status ON insights (user_id, status);
CREATE INDEX IF NOT EXISTS idx_insights_user_area ON insights (user_id, life_area);

CREATE TABLE IF NOT EXISTS insight_evidence (
  id               SERIAL PRIMARY KEY,
  insight_id       INTEGER NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  source_type      TEXT NOT NULL,
  source_record_id INTEGER NOT NULL,
  event_date       DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insight_evidence_insight ON insight_evidence (insight_id);
CREATE INDEX IF NOT EXISTS idx_insight_evidence_source
  ON insight_evidence (source_type, source_record_id);

CREATE TABLE IF NOT EXISTS insight_conflicts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  insight_id      INTEGER NOT NULL REFERENCES insights(id),
  conflict_type   TEXT NOT NULL,
  description     TEXT NOT NULL,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_insight_conflicts_insight ON insight_conflicts (insight_id, resolved);

-- -------------------------------------------------------------
-- Knowledge graph
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  subject        TEXT NOT NULL,
  relation       TEXT NOT NULL,
  object         TEXT NOT NULL,
  life_area      TEXT NOT NULL,
  weight         NUMERIC NOT NULL DEFAULT 0 CHECK (weight BETWEEN -1 AND 1),
  confidence     NUMERIC NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, subject, relation, object)
);
CREATE INDEX IF NOT EXISTS idx_kg_edges_user_subject ON knowledge_graph_edges (user_id, subject);
CREATE INDEX IF NOT EXISTS idx_kg_edges_user_object ON knowledge_graph_edges (user_id, object);
CREATE INDEX IF NOT EXISTS idx_kg_edges_user_area ON knowledge_graph_edges (user_id, life_area);

-- -------------------------------------------------------------
-- Pattern discovery tables
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS correlation_candidates (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  feature_x        TEXT NOT NULL,
  feature_y        TEXT NOT NULL,
  lag_days         SMALLINT NOT NULL DEFAULT 0,
  n                INTEGER NOT NULL,
  r                NUMERIC(6,4),
  effect_size      NUMERIC(8,4),
  window_days      INTEGER NOT NULL DEFAULT 90,
  life_area        TEXT,
  promoted         BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_correlation_candidates_user
  ON correlation_candidates (user_id, promoted, computed_at DESC);

CREATE TABLE IF NOT EXISTS seasonal_patterns (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  pattern_type  TEXT NOT NULL,
  dimension     TEXT NOT NULL,
  metric        TEXT NOT NULL,
  baseline_avg  NUMERIC(6,3),
  pattern_avg   NUMERIC(6,3),
  delta         NUMERIC(6,3),
  n             INTEGER NOT NULL,
  life_area     TEXT,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pattern_type, dimension, metric)
);

CREATE TABLE IF NOT EXISTS anomaly_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  event_date   DATE NOT NULL,
  metric       TEXT NOT NULL,
  life_area    TEXT NOT NULL,
  baseline     NUMERIC(8,3),
  observed     NUMERIC(8,3),
  z_score      NUMERIC(6,3),
  severity     TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe')),
  direction    TEXT NOT NULL CHECK (direction IN ('low','high')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_user_date ON anomaly_events (user_id, event_date DESC);

CREATE TABLE IF NOT EXISTS success_patterns (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  pattern_name   TEXT NOT NULL,
  life_area      TEXT NOT NULL,
  conditions     JSONB NOT NULL,
  outcome_metric TEXT NOT NULL,
  outcome_avg    NUMERIC(8,3),
  baseline_avg   NUMERIC(8,3),
  n              INTEGER NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pattern_name, outcome_metric)
);

-- -------------------------------------------------------------
-- Reflection embeddings
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reflection_embeddings (
  reflection_id     INTEGER PRIMARY KEY REFERENCES reflections(id) ON DELETE CASCADE,
  embedding         vector(1024),
  embedding_model   TEXT NOT NULL DEFAULT 'voyage-3',
  embedding_version TEXT NOT NULL DEFAULT '1',
  embedded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reflection_embeddings_embedding
  ON reflection_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -------------------------------------------------------------
-- Prediction records
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS prediction_records (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL,
  prediction_type      TEXT NOT NULL,
  prediction           TEXT NOT NULL,
  prediction_reasoning TEXT,
  life_area            TEXT,
  confidence           NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  uncertainty_low      NUMERIC(6,2),
  uncertainty_high     NUMERIC(6,2),
  target_date          DATE NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome              TEXT,
  accuracy             NUMERIC(4,3),
  evaluated_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_prediction_records_user_target
  ON prediction_records (user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_prediction_records_unevaluated
  ON prediction_records (user_id, evaluated_at) WHERE evaluated_at IS NULL;

-- -------------------------------------------------------------
-- Processing infrastructure
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS processing_cursors (
  user_id           INTEGER NOT NULL,
  pipeline_stage    TEXT NOT NULL,
  processed_through DATE,
  last_run          TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'idle'
                    CHECK (status IN ('idle', 'running', 'error')),
  error_count       INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  next_recompute_at DATE,
  PRIMARY KEY (user_id, pipeline_stage)
);

CREATE TABLE IF NOT EXISTS memory_access_logs (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  record_type      TEXT NOT NULL,
  record_id        INTEGER NOT NULL,
  retrieval_score  NUMERIC(6,4),
  retrieval_method TEXT NOT NULL,
  retrieval_reason TEXT,
  response_type    TEXT,
  query_hash       TEXT,
  context          TEXT,
  accessed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_user
  ON memory_access_logs (user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_record
  ON memory_access_logs (record_type, record_id);

-- -------------------------------------------------------------
-- Long-term analytics
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS weekly_metrics (
  user_id                INTEGER NOT NULL,
  week_of                DATE NOT NULL,
  sleep_avg              NUMERIC(5,2),
  readiness_avg          NUMERIC(5,2),
  hrv_avg                NUMERIC(5,2),
  resting_hr_avg         NUMERIC(5,2),
  mood_avg               NUMERIC(5,2),
  confidence_avg         NUMERIC(5,2),
  habits_completion_rate NUMERIC(4,3),
  exercise_days          SMALLINT,
  alcohol_days           SMALLINT,
  caffeine_late_days     SMALLINT,
  PRIMARY KEY (user_id, week_of)
);

CREATE TABLE IF NOT EXISTS monthly_metrics (
  user_id                INTEGER NOT NULL,
  month_of               DATE NOT NULL,
  sleep_avg              NUMERIC(5,2),
  readiness_avg          NUMERIC(5,2),
  hrv_avg                NUMERIC(5,2),
  mood_avg               NUMERIC(5,2),
  confidence_avg         NUMERIC(5,2),
  habits_completion_rate NUMERIC(4,3),
  exercise_days          SMALLINT,
  best_week_of           DATE,
  worst_week_of          DATE,
  PRIMARY KEY (user_id, month_of)
);

CREATE TABLE IF NOT EXISTS yearly_metrics (
  user_id                INTEGER NOT NULL,
  year                   SMALLINT NOT NULL,
  sleep_avg              NUMERIC(5,2),
  readiness_avg          NUMERIC(5,2),
  hrv_avg                NUMERIC(5,2),
  mood_avg               NUMERIC(5,2),
  confidence_avg         NUMERIC(5,2),
  habits_completion_rate NUMERIC(4,3),
  best_month_of          DATE,
  worst_month_of         DATE,
  PRIMARY KEY (user_id, year)
);

-- -------------------------------------------------------------
-- Schema alterations to existing tables
-- -------------------------------------------------------------

ALTER TABLE briefings ADD COLUMN IF NOT EXISTS data_hash TEXT;
