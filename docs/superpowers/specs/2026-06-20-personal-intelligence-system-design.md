# Personal Intelligence System — Architecture Specification

**Date:** 2026-06-20  
**Status:** Approved — ready for implementation planning  
**Project:** Oura Personal Intelligence OS  
**Stack:** Next.js · TypeScript · PostgreSQL (Neon) · Anthropic Claude · Voyage AI · pgvector

---

## 1. Product Vision

Transform the Oura dashboard into a **personal intelligence operating system** — a system that remembers everything, discovers patterns automatically, and provides increasingly valuable guidance as data accumulates over years.

The system should answer:

- **What happened** — via memory hierarchy and summaries
- **Why it happened** — via pattern engine and knowledge graph
- **What is likely to happen next** — via predictive intelligence
- **What actions produce the best outcome** — via insight records and recommendations

It functions as: health analyst · performance coach · academic advisor · habit coach · pattern detector · long-term memory system.

### Core Architecture Principle

> **Statistics first. Rules second. LLMs third.**

Order of operations for every pipeline stage:
1. Raw data ingestion
2. Deterministic fact extraction (SQL / application logic)
3. Statistical analysis (Pearson correlations, z-scores, trend slopes)
4. Pattern detection (feature vector analysis, anomaly detection)
5. Insight generation (statistical thresholds gate promotion)
6. LLM explanation (Haiku for facts/edges; Sonnet for synthesis only)

Never use an LLM where SQL, rules, or statistics can provide the answer.

---

## 2. System Architecture

The system operates across three planes:

```
┌────────────────────────────────────────────────────────────────┐
│  INGESTION PLANE  (real-time / on-demand)                      │
│  Oura sync · webhook · reflection POST · intake log            │
│  mood log · weight log · study session · calendar sync         │
│  → writes only to Layer 1 raw tables                          │
└────────────────────────────────────────────────────────────────┘
                        ↓  daily cron advances cursors
┌────────────────────────────────────────────────────────────────┐
│  PROCESSING PLANE  (cursor-based incremental pipeline)         │
│                                                                │
│  L1  Raw Events         ← permanent, never modified           │
│   ↓ deterministic rules + Haiku (reflection only)             │
│  L2  Extracted Facts    ← one row per fact per day            │
│   ↓ Haiku                                                     │
│  L3  Daily Summaries    ← one record per day + embedding      │
│   ↓ Voyage AI                                                 │
│  [Embedding Index]      ← pgvector HNSW, cosine               │
│   ↓ Sonnet (Monday)                                           │
│  L4  Weekly Summaries   ← one record per week + embedding     │
│   ↓ Sonnet (1st of month)                                     │
│  L5  Monthly Summaries  ← one record per month + embedding    │
│   ↓ Sonnet (incremental, thresholded)                         │
│  L6  Insight Records    ← reusable claims + embedding         │
│                                                                │
│  Pattern Engine  (SQL stats → Haiku) → knowledge_graph_edges  │
│  Prediction Engine  (SQL rules) → prediction_records          │
└────────────────────────────────────────────────────────────────┘
                        ↓  on-demand retrieval
┌────────────────────────────────────────────────────────────────┐
│  INTELLIGENCE PLANE  (request-time)                            │
│                                                                │
│  Morning Briefing  → 7 daily summaries + 5 insights + events  │
│  User Query        → intent detection → semantic retrieval     │
│  Weekly Review     → 7 daily + 4 weekly + 10 insights         │
│  Predictions       → pattern match + graph edges              │
│                                                                │
│  Sonnet never receives raw historical rows                     │
└────────────────────────────────────────────────────────────────┘
```

**Scalability invariant:** Sonnet consumes only pre-summarized content from L3–L6 and retrieved records. Token cost is bounded by retrieval budget (typically 2,500–3,000 tokens), not by years of accumulated history.

---

## 3. Data Model

### 3.1 Layer 1 — Raw Events

All raw tables are **append-only and permanent**.

#### Existing tables (unchanged)
- `oura_daily` — sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds, raw_payload
- `reflections` + `reflection_metadata` — raw text + AI-extracted metadata
- `intake_log` — caffeine, alcohol, workout (type, quantity, unit, timestamp)
- `habit_completions` + `goals` — daily habit tracking
- `calendar_events` — title, kind, starts_at

#### Existing tables needing schema alterations
- `briefings` — add `data_hash TEXT` for change-detection caching
- `weekly_patterns` — **superseded** by `weekly_summaries`; keep for historical reads but stop writing new rows
- `narratives` — **superseded** by `monthly_summaries`; keep for historical reads but stop writing new rows

#### New Layer 1 tables

```sql
CREATE TABLE mood_logs (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL,
  log_date  DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mood      SMALLINT CHECK (mood BETWEEN 1 AND 10),
  energy    SMALLINT CHECK (energy BETWEEN 1 AND 10),
  stress    SMALLINT CHECK (stress BETWEEN 1 AND 10),
  note      TEXT
);
CREATE INDEX ON mood_logs (user_id, log_date);

CREATE TABLE weight_logs (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL,
  log_date  DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight_kg NUMERIC(5,2) NOT NULL,
  note      TEXT
);
CREATE INDEX ON weight_logs (user_id, log_date);

CREATE TABLE academic_events (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  course          TEXT NOT NULL,
  event_type      TEXT NOT NULL,  -- 'exam'|'quiz'|'midterm'|'presentation'|'due_date'
  event_date      DATE NOT NULL,
  importance      SMALLINT CHECK (importance BETWEEN 1 AND 5),
  expected_stress SMALLINT CHECK (expected_stress BETWEEN 1 AND 10),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON academic_events (user_id, event_date);

CREATE TABLE confidence_logs (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  log_date         DATE NOT NULL,
  course           TEXT NOT NULL,
  confidence_score SMALLINT CHECK (confidence_score BETWEEN 1 AND 10),
  stress_score     SMALLINT CHECK (stress_score BETWEEN 1 AND 10),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON confidence_logs (user_id, log_date);

CREATE TABLE outcomes (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  outcome_date    DATE NOT NULL,
  course          TEXT NOT NULL,
  assessment_type TEXT NOT NULL,  -- 'exam'|'quiz'|'project'|'presentation'
  score           NUMERIC(5,2),
  grade           TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON outcomes (user_id, outcome_date);

CREATE TABLE study_sessions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  session_date      DATE NOT NULL,
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  course            TEXT NOT NULL,
  duration_minutes  INTEGER NOT NULL,
  method            TEXT NOT NULL,
  -- 'active_recall'|'flashcards'|'rereading'|'practice_problems'|'teaching'|'spaced_repetition'
  confidence_before SMALLINT CHECK (confidence_before BETWEEN 1 AND 10),
  confidence_after  SMALLINT CHECK (confidence_after BETWEEN 1 AND 10),
  notes             TEXT
);
CREATE INDEX ON study_sessions (user_id, session_date);
```

---

### 3.2 Layer 2 — Extracted Facts

One row per fact per day. The pattern engine reads this table exclusively; it never reads raw rows directly.

```sql
CREATE TABLE daily_facts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  fact_date   DATE NOT NULL,
  fact_type   TEXT NOT NULL,
  -- deterministic: 'sleep_under_7h'|'sleep_over_8h'|'readiness_anomaly_low'|
  --   'readiness_anomaly_high'|'alcohol_day'|'caffeine_after_14'|'workout_day'|
  --   'sleep_debt_high'|'exam_today'|'exam_tomorrow'|'hrv_anomaly_low'
  -- LLM-extracted: 'high_stress_signal'|'study_method_active_recall'|
  --   'unusual_event'|'positive_mood_signal'
  source      TEXT NOT NULL,    -- 'oura'|'reflection'|'calendar'|'intake'|'habit'|'mood'|'rule'
  life_area   TEXT NOT NULL,    -- 'sleep'|'recovery'|'academics'|'productivity'|
                                --   'mood'|'nutrition'|'fitness'|'stress'
  value_num   NUMERIC,
  value_text  TEXT,
  confidence  NUMERIC NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON daily_facts (user_id, fact_date);
CREATE INDEX ON daily_facts (user_id, fact_type);
CREATE INDEX ON daily_facts (user_id, life_area, fact_date DESC);
```

**Deterministic facts** are generated by SQL/application logic before any LLM is called.
**LLM facts** (Haiku only) are generated for reflections — stress signals, study method mentions, unusual events.

---

### 3.3 Feature Vectors

One row per day. Primary input for statistical pattern detection. No LLM involved in generation.

```sql
CREATE TABLE daily_feature_vectors (
  user_id              INTEGER NOT NULL,
  vector_date          DATE NOT NULL,
  -- Health metrics
  sleep_hours          NUMERIC(4,2),
  readiness            NUMERIC(5,2),
  hrv                  NUMERIC(5,2),
  resting_hr           NUMERIC(5,2),
  activity_score       NUMERIC(5,2),
  steps                INTEGER,
  -- Intake
  caffeine_mg          NUMERIC(7,2),
  alcohol_drinks       NUMERIC(4,2),
  workout_count        SMALLINT,
  -- Subjective
  mood_score           NUMERIC(4,2),
  stress_score         NUMERIC(4,2),
  confidence_score     NUMERIC(4,2),
  energy_score         NUMERIC(4,2),
  -- Derived
  sleep_debt_7d        NUMERIC(5,2),   -- rolling 7-day deficit vs 8h/night target
  readiness_delta      NUMERIC(5,2),   -- today minus yesterday
  hrv_delta            NUMERIC(5,2),
  -- Composite scores (deterministic formulas — see Section 7)
  health_score         NUMERIC(5,2),
  focus_score          NUMERIC(5,2),
  recovery_score       NUMERIC(5,2),
  academic_readiness   NUMERIC(5,2),
  PRIMARY KEY (user_id, vector_date)
);
CREATE INDEX ON daily_feature_vectors (user_id, vector_date DESC);
```

---

### 3.4 Layer 3 — Daily Summaries

```sql
CREATE TABLE daily_summaries (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  summary_date    DATE NOT NULL,
  summary_text    TEXT NOT NULL,       -- Haiku: 2–3 sentence natural language summary
  key_events      TEXT[],
  top_insights    TEXT[],              -- insight_key slugs relevant to this day
  life_area       TEXT,
  scores          JSONB,               -- overflow / extra metrics
  health_score    NUMERIC(5,2),
  focus_score     NUMERIC(5,2),
  energy_score    NUMERIC(5,2),
  recovery_score  NUMERIC(5,2),
  -- Embedding
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  -- Quality signals
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, summary_date)
);
CREATE INDEX ON daily_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX ON daily_summaries (user_id, summary_date DESC);
```

---

### 3.5 Layer 4 — Weekly Summaries

```sql
CREATE TABLE weekly_summaries (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  week_of           DATE NOT NULL,     -- Monday of the week
  summary_text      TEXT NOT NULL,     -- Sonnet: weekly intelligence review
  positive_patterns TEXT[],
  negative_patterns TEXT[],
  recommendations   TEXT[],
  focus_trends      TEXT[],
  energy_trends     TEXT[],
  academic_trends   TEXT[],
  life_area         TEXT,
  scores            JSONB NOT NULL,
  -- Embedding
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  -- Quality signals
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_of)
);
CREATE INDEX ON weekly_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

### 3.6 Layer 5 — Monthly Summaries

```sql
CREATE TABLE monthly_summaries (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  month_of         DATE NOT NULL,      -- 1st of the month
  narrative        TEXT NOT NULL,      -- Sonnet: 3–4 paragraphs
  major_trends     TEXT[],
  recurring_themes TEXT[],
  predictions      TEXT[],
  life_area        TEXT,
  scores           JSONB NOT NULL,
  -- Embedding
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  -- Quality signals
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_of)
);
CREATE INDEX ON monthly_summaries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

### 3.7 Layer 6 — Insight Records

The most important layer. Reusable compressed knowledge claims.

**Promotion thresholds** (hard gates — no exceptions):
- `minimum_evidence_count`: 5
- `minimum_confidence`: 0.60
- `minimum_effect_size`: 5.0 (score units, hours, or %)

```sql
CREATE TABLE insights (
  id                        SERIAL PRIMARY KEY,
  user_id                   INTEGER NOT NULL,
  insight_key               TEXT NOT NULL,    -- stable slug: 'sleep_biology_performance'
  category                  TEXT NOT NULL,    -- 'sleep'|'academic'|'habit'|'recovery'|'nutrition'|'mood'
  life_area                 TEXT NOT NULL,
  claim                     TEXT NOT NULL,    -- "Sleep >8h before Biology exams correlates with higher confidence"
  explanation               TEXT,             -- "Across 15 assessments, scores averaged 9.4% higher..."
  evidence_summary          TEXT,
  evidence_count            INTEGER NOT NULL DEFAULT 0,
  confidence                NUMERIC NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  supporting_metrics        JSONB,
  counterfactual_support    TEXT,             -- "If sleep had been >8h, readiness likely would have been higher"
  status                    TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'weakening', 'archived', 'conflict')),
  first_detected            DATE NOT NULL,
  last_confirmed            DATE,
  last_evaluated            DATE,
  -- Decay
  decay_score               NUMERIC NOT NULL DEFAULT 1.0,
  predictive_accuracy_factor NUMERIC NOT NULL DEFAULT 1.0,
  -- Embedding
  embedding               vector(1024),
  embedding_model         TEXT DEFAULT 'voyage-3',
  embedding_version       TEXT DEFAULT '1',
  embedded_at             TIMESTAMPTZ,
  -- Quality signals
  retrieval_count         INTEGER NOT NULL DEFAULT 0,
  successful_retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved          TIMESTAMPTZ,
  model_ver               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, insight_key)
);
CREATE INDEX ON insights USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX ON insights (user_id, status);
CREATE INDEX ON insights (user_id, life_area);

-- Explainability: source records that support each insight
CREATE TABLE insight_evidence (
  id               SERIAL PRIMARY KEY,
  insight_id       INTEGER NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  source_type      TEXT NOT NULL,  -- 'daily_fact'|'daily_summary'|'oura_daily'|'outcome'
  source_record_id INTEGER NOT NULL,
  event_date       DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON insight_evidence (insight_id);
CREATE INDEX ON insight_evidence (source_type, source_record_id);

-- Conflict detection: flags before archiving
CREATE TABLE insight_conflicts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  insight_id      INTEGER NOT NULL REFERENCES insights(id),
  conflict_type   TEXT NOT NULL,   -- 'contradicting_evidence'|'decaying_correlation'|'model_changed'
  description     TEXT NOT NULL,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX ON insight_conflicts (insight_id, resolved);
```

---

### 3.8 Knowledge Graph

```sql
CREATE TABLE knowledge_graph_edges (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  subject        TEXT NOT NULL,    -- 'sleep_8h_plus'|'late_caffeine'|'exercise'
  relation       TEXT NOT NULL,    -- 'improves'|'reduces'|'predicts'|'correlates_with'
  object         TEXT NOT NULL,    -- 'biology_performance'|'readiness'|'mood'
  life_area      TEXT NOT NULL,
  weight         NUMERIC NOT NULL DEFAULT 0 CHECK (weight BETWEEN -1 AND 1),
  confidence     NUMERIC NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, subject, relation, object)
);
CREATE INDEX ON knowledge_graph_edges (user_id, subject);
CREATE INDEX ON knowledge_graph_edges (user_id, object);
CREATE INDEX ON knowledge_graph_edges (user_id, life_area);
```

---

### 3.9 Pattern Discovery Tables

```sql
-- Intermediate statistical findings before Haiku evaluates
CREATE TABLE correlation_candidates (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  feature_x        TEXT NOT NULL,
  feature_y        TEXT NOT NULL,
  lag_days         SMALLINT NOT NULL DEFAULT 0,
  n                INTEGER NOT NULL,
  r                NUMERIC(6,4),     -- Pearson r
  effect_size      NUMERIC(8,4),
  window_days      INTEGER NOT NULL DEFAULT 90,
  life_area        TEXT,
  promoted         BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at      TIMESTAMPTZ
);
CREATE INDEX ON correlation_candidates (user_id, promoted, computed_at DESC);

-- Seasonality: weekday / exam-week / monthly effects
CREATE TABLE seasonal_patterns (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  pattern_type  TEXT NOT NULL,    -- 'weekday'|'weekend'|'exam_week'|'monthly'
  dimension     TEXT NOT NULL,    -- 'monday'|'exam_week'|'month_3' etc.
  metric        TEXT NOT NULL,    -- 'readiness'|'stress'|'mood'
  baseline_avg  NUMERIC(6,3),
  pattern_avg   NUMERIC(6,3),
  delta         NUMERIC(6,3),
  n             INTEGER NOT NULL,
  life_area     TEXT,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pattern_type, dimension, metric)
);

-- Anomaly events: detected unusual readings
CREATE TABLE anomaly_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  event_date   DATE NOT NULL,
  metric       TEXT NOT NULL,    -- 'sleep_hours'|'readiness'|'hrv'|'stress'|'mood'
  life_area    TEXT NOT NULL,
  baseline     NUMERIC(8,3),
  observed     NUMERIC(8,3),
  z_score      NUMERIC(6,3),
  severity     TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe')),
  direction    TEXT NOT NULL CHECK (direction IN ('low','high')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON anomaly_events (user_id, event_date DESC);

-- Success patterns: what conditions produce best outcomes
CREATE TABLE success_patterns (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  pattern_name   TEXT NOT NULL,   -- 'best_readiness_day'|'best_exam_outcome'
  life_area      TEXT NOT NULL,
  conditions     JSONB NOT NULL,  -- {"sleep_hours": ">8", "workout": true, "caffeine_after_14": false}
  outcome_metric TEXT NOT NULL,
  outcome_avg    NUMERIC(8,3),
  baseline_avg   NUMERIC(8,3),
  n              INTEGER NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pattern_name, outcome_metric)
);
```

---

### 3.10 Reflection Embeddings

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE reflection_embeddings (
  reflection_id     INTEGER PRIMARY KEY REFERENCES reflections(id) ON DELETE CASCADE,
  embedding         vector(1024),
  embedding_model   TEXT NOT NULL DEFAULT 'voyage-3',
  embedding_version TEXT NOT NULL DEFAULT '1',
  embedded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON reflection_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Long reflections (> 1,500 characters): Haiku generates a compressed summary first; the summary is embedded, not the raw text. Original reflection is unchanged.

---

### 3.11 Prediction Records

```sql
CREATE TABLE prediction_records (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL,
  prediction_type      TEXT NOT NULL,   -- 'readiness'|'stress'|'sleep_debt'|'performance'|'hrv'
  prediction           TEXT NOT NULL,   -- natural language
  prediction_reasoning TEXT,            -- "Biology exam in 3 days. Similar events produced elevated stress 7/9 times."
  life_area            TEXT,
  confidence           NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  uncertainty_low      NUMERIC(6,2),    -- lower bound of confidence interval
  uncertainty_high     NUMERIC(6,2),    -- upper bound
  target_date          DATE NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome              TEXT,
  accuracy             NUMERIC(4,3),
  evaluated_at         TIMESTAMPTZ
);
CREATE INDEX ON prediction_records (user_id, target_date);
CREATE INDEX ON prediction_records (user_id, evaluated_at) WHERE evaluated_at IS NULL;
```

---

### 3.12 Processing Infrastructure

```sql
CREATE TABLE processing_cursors (
  user_id           INTEGER NOT NULL,
  pipeline_stage    TEXT NOT NULL,
  -- 'facts' | 'feature_vectors' | 'daily_summary' | 'reflection_embed'
  -- 'summary_embed' | 'patterns' | 'graph_edges' | 'insights'
  -- 'weekly_summary' | 'monthly_summary'
  -- 'weekly_metrics' | 'monthly_metrics' | 'yearly_metrics'
  -- 'predictions' | 'seasonality' | 'anomalies' | 'success_patterns'
  processed_through DATE,
  last_run          TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'idle'
                    CHECK (status IN ('idle', 'running', 'error')),
  error_count       INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  next_recompute_at DATE,
  PRIMARY KEY (user_id, pipeline_stage)
);

CREATE TABLE memory_access_logs (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  record_type      TEXT NOT NULL,   -- 'reflection'|'daily_summary'|'weekly_summary'|
                                    -- 'monthly_summary'|'insight'
  record_id        INTEGER NOT NULL,
  retrieval_score  NUMERIC(6,4),
  retrieval_method TEXT NOT NULL,   -- 'semantic'|'graph'|'chronological'|'fulltext'
  retrieval_reason TEXT,            -- 'morning_briefing'|'user_query'|'weekly_review'
  response_type    TEXT,            -- 'briefing'|'answer'|'prediction'|'recommendation'
  query_hash       TEXT,
  context          TEXT,
  accessed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON memory_access_logs (user_id, accessed_at DESC);
CREATE INDEX ON memory_access_logs (record_type, record_id);
```

---

### 3.13 Long-Term Analytics

Pre-aggregated by SQL; never recomputed from scratch.

```sql
CREATE TABLE weekly_metrics (
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

CREATE TABLE monthly_metrics (
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

CREATE TABLE yearly_metrics (
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
```

---

## 4. Processing Pipeline

### 4.1 Cron schedule

| Trigger | Jobs |
|---|---|
| Daily | syncOura · syncCalendar · advanceFacts · advanceFeatureVectors · advanceAnomalies · advanceDailySummary · advanceEmbeddings · advancePatterns · advanceInsights · advancePredictions · generateBriefing (if data changed) |
| Monday | advanceWeeklySummary · advanceWeeklyMetrics · embedWeeklySummary |
| 1st of month | advanceMonthlySummary · advanceMonthlyMetrics · embedMonthlySummary |
| Recompute (monthly) | re-score correlations on last 30-day window |
| Recompute (quarterly) | re-evaluate insight decay · update graph edge confidence · run success_patterns |
| Recompute (annual) | full insight regeneration · retire stale graph edges |

### 4.2 Stage token budgets

| Stage | Model | Input cap | Output |
|---|---|---|---|
| advanceFacts (reflection) | Haiku | ~400 tokens per reflection | Structured fact list |
| advanceDailySummary | Haiku | ~300 tokens (daily facts) | Summary + scores |
| advancePatterns (explanation) | Haiku | ~600 tokens (statistical findings) | Graph edge upserts |
| advanceInsights | Sonnet | ~3,000 tokens (weekly summaries + graph) | Insight upserts — runs only when ≥1 new weekly summary exists and at least one correlation candidate passed promotion thresholds |
| generateBriefing | Sonnet | ~2,500 tokens (budgeted context) | Structured briefing |
| advanceWeeklySummary | Sonnet | ~2,000 tokens (7 daily summaries) | Weekly review |
| advanceMonthlySummary | Sonnet | ~2,000 tokens (4 weekly summaries) | Monthly narrative |

**Total daily Sonnet cost (steady state): ~7,500 tokens input + ~1,500 tokens output.** Does not grow with data volume.

### 4.3 Briefing change detection

Before calling Sonnet for a briefing, compute:
```
dataHash = sha256(latestOuraDay + lastCalendarSyncAt + lastInsightUpdatedAt + activePredictionCount)
```
If `dataHash === briefings.data_hash` for today → return cached briefing. Sonnet is not called.

---

## 5. Semantic Memory + Retrieval

### 5.1 Embedding text construction

| Record type | Text sent to Voyage AI |
|---|---|
| Reflection | `raw_text` (or compressed summary if > 1,500 chars) |
| Daily summary | `summary_text + key_events[] + top_insights[]` |
| Weekly summary | `summary_text + positive_patterns[] + negative_patterns[]` |
| Monthly summary | `narrative + major_trends[]` |
| Insight | `claim + evidence_summary + explanation` |

Raw Oura rows, feature vectors, and aggregate metrics are **never embedded**.

### 5.2 Retrieval budgets

```typescript
const RETRIEVAL_BUDGETS = {
  morning_briefing: {
    daily_summaries:   7,   // chronological (last 7)
    insights:          5,   // semantic search
    calendar_events:   5,   // upcoming, chronological
    predictions:       3,   // active, chronological
  },
  user_question: {
    daily_summaries:   5,   // semantic
    weekly_summaries:  3,   // semantic
    monthly_summaries: 2,   // semantic
    reflections:       5,   // semantic
    insights:          5,   // semantic
    graph_edges:       10,  // entity match
  },
  weekly_review: {
    daily_summaries:   7,   // chronological
    weekly_summaries:  4,   // chronological
    insights:          10,  // active, confidence DESC
    graph_edges:       10,
  },
};
```

### 5.3 Ranking formula

```
final_score = semantic_similarity × recency_weight × retrieval_quality_weight

recency_weight:
  0–30 days:   1.0
  30–90 days:  0.8
  90–365 days: 0.6
  > 1 year:    0.4
  (active insights: always 1.0 regardless of age)

retrieval_quality_weight = successful_retrieval_count / max(retrieval_count, 1)
  defaults to 1.0 until signal accumulates
```

**Retrieval priority order:**
1. Active insights (compressed knowledge; highest value per token)
2. Graph edges (entity-matched)
3. Daily summaries
4. Weekly summaries
5. Monthly summaries
6. Reflections

### 5.4 Query intent detection

Lightweight classifier (regex + keyword scoring, no LLM):

```typescript
const INTENT_SIGNALS = {
  explanation:    ['why', 'what caused', 'reason', 'because'],
  prediction:     ['will', 'likely', 'expect', 'tomorrow', 'next week'],
  academic:       ['exam', 'biology', 'grade', 'score', 'study', 'confidence'],
  health:         ['sleep', 'readiness', 'hrv', 'recovery', 'heart rate'],
  stress:         ['stress', 'anxious', 'overwhelmed', 'pressure'],
  recommendation: ['should', 'improve', 'better', 'optimize', 'how to'],
  trend:          ['trend', 'over time', 'lately', 'recently', 'this month'],
};
// Output: { intent, lifeAreaBoost[], lifeAreaReduce[] }
// → selects budget profile and applies life_area weighting to ranking
```

### 5.5 Retrieval diversity

After initial ranking, apply MMR-style deduplication: if any two retrieved records share > 80% lexical overlap in their content, keep only the highest-ranked and replace the lower with the next-best non-overlapping result.

### 5.6 Source attribution

Every retrieved record carries `{ source_type, source_id, source_date }` through to the Sonnet prompt. Sonnet is instructed to reference sources in its output. Future UI renders "Based on: Insight A · Weekly Summary B · Reflection C."

### 5.7 Full-text fallback

When pgvector is unavailable or Voyage AI returns an error:

```sql
SELECT id, summary_date, summary_text, life_area,
       ts_rank(to_tsvector('english', summary_text), plainto_tsquery($query)) AS score
FROM daily_summaries
WHERE user_id = $userId
  AND to_tsvector('english', summary_text) @@ plainto_tsquery($query)
ORDER BY score DESC LIMIT $n
```

Same pattern for all layers. `memory_access_logs.retrieval_method = 'fulltext'`.

---

## 6. Pattern Discovery Engine

### 6.1 Two-stage architecture

**Stage 1 — SQL/TypeScript statistics (no LLM):**
- Reads `daily_feature_vectors` over a 90-day window
- Computes Pearson r for all numeric feature pairs with lags: same-day, +1, +2, +3, +7 days
- Minimum N = 10, minimum variance threshold (SD > 0.5), |r| >= 0.25, |effect_size| >= 2.0
- Writes qualifying pairs to `correlation_candidates`
- Detects anomalies → writes to `anomaly_events`
- Detects seasonality → writes to `seasonal_patterns`
- Identifies success conditions → writes to `success_patterns`

**Stage 2 — Haiku explains (< 600 tokens input):**
- Receives compact JSON of candidates above thresholds
- Writes natural-language descriptions
- Upserts `knowledge_graph_edges`
- Flags candidates meeting insight promotion thresholds

### 6.2 Correlations tested (non-exhaustive; engine also auto-discovers)

| X | Y | Lag |
|---|---|---|
| sleep_hours | readiness | +1 day |
| sleep_hours | mood_score | +1 day |
| sleep_hours | hrv | +1 day |
| alcohol_drinks | readiness | +1 day |
| alcohol_drinks | hrv | +1 day |
| caffeine_mg | readiness | +1 day |
| caffeine_mg | sleep_hours | same day |
| workout_count | mood_score | same day |
| workout_count | readiness | +1 day |
| stress_score | sleep_hours | same night |
| sleep_debt_7d | readiness | same day |
| confidence_score | outcome.score | within 3 days |
| sleep_hours (pre-exam) | outcome.score | academic join |
| study_session.method | confidence_delta | same day |
| stress_score | confidence_score | same day / +1 day |

### 6.3 Insight decay formula

```
decay_score =
  base_confidence
  × recency_factor
  × evidence_stability
  × predictive_accuracy_factor

recency_factor:
  last_confirmed < 30 days  → 1.0
  30–90 days                → 0.8
  90–180 days               → 0.6
  > 180 days                → 0.2

evidence_stability = new_evidence_last_90d / expected_rate_per_90d

predictive_accuracy_factor:
  no predictions yet  → 1.0
  avg_accuracy >= 0.7 → 1.0
  avg_accuracy 0.4–0.7 → 0.8
  avg_accuracy < 0.4  → 0.5

Status transitions:
  decay_score > 0.6  → 'active'
  decay_score 0.3–0.6 → 'weakening'
  decay_score < 0.3  → 'archived' (flagged in insight_conflicts first)
```

---

## 7. Composite Scores (Deterministic Formulas)

No LLM. Computed from `daily_feature_vectors`.

```typescript
health_score =
  0.35 × normalize(readiness, 0, 100)
  + 0.30 × normalize(sleep_hours, 0, 10)  // capped at 10h
  + 0.20 × normalize(hrv, 0, 100)
  + 0.15 × (1 - normalize(resting_hr, 40, 80))

focus_score =
  0.40 × normalize(readiness, 0, 100)
  + 0.30 × normalize(mood_score, 1, 10)
  + 0.20 × normalize(confidence_score, 1, 10)
  + 0.10 × (1 - normalize(stress_score, 1, 10))

recovery_score =
  0.40 × normalize(readiness, 0, 100)
  + 0.30 × normalize(hrv, 0, 100)
  + 0.20 × normalize(sleep_hours, 0, 10)
  + 0.10 × (1 - normalize(sleep_debt_7d, 0, 14))  // capped at 14h debt

academic_readiness =
  0.35 × focus_score
  + 0.30 × recovery_score
  + 0.25 × normalize(confidence_score, 1, 10)
  + 0.10 × (1 - normalize(stress_score, 1, 10))
```

All `normalize(value, min, max)` → `Math.max(0, Math.min(1, (value - min) / (max - min)))`. Output scores are in [0, 100] after multiplying by 100. Null inputs propagate as null (score not computed if any required input is missing).

---

## 8. Predictive Intelligence

### 8.1 Prediction generation (statistics + rules first, Haiku writes text)

| Type | Logic | Model |
|---|---|---|
| Readiness tomorrow | slope(readiness, 5d) < -2 AND sleep_debt_7d > 3 | SQL rule |
| Sleep debt EOW | current_debt + projected_deficit × days_remaining | SQL math |
| Exam stress | upcoming academic_events with expected_stress >= 7 in next 7 days | SQL join |
| Performance | sleep_hours(pre-exam) + graph_edges(sleep→course_performance) | SQL + graph |
| HRV decline | slope(hrv, 7d) < -1.5 SD below baseline | SQL z-score |

Academic prediction inputs (enhanced engine):
- days_before_exam
- cumulative_sleep_debt
- stress_trend (7-day slope)
- readiness_trend (7-day slope)
- study_method_mix (active_recall%, flashcards%, rereading%)
- confidence_trend

### 8.2 Prediction record fields
- `prediction_reasoning`: "Biology exam in 3 days. Similar events produced elevated stress 7/9 times. Sleep debt currently 4.2h."
- `uncertainty_low` / `uncertainty_high`: confidence interval bounds (e.g., 72–84 for expected readiness of 78)
- `accuracy`: populated after `target_date` passes via background evaluation job

### 8.3 Prediction evaluation loop

Daily, for all `prediction_records` where `target_date < today AND accuracy IS NULL`:
1. Fetch actual outcome
2. Score accuracy: `1 - abs(predicted - actual) / baseline_range`
3. Write accuracy back
4. Recompute `predictive_accuracy_factor` for linked insights

---

## 9. Morning Briefing

### 9.1 Context window (hard budget)

```typescript
{
  today: { date, health_score, focus_score, recovery_score, sleep_hours, readiness },
  recent: last7DailySummaries,        // max 7
  insights: activeInsights(5),        // semantic search, life_area boosted
  events: upcomingEvents(5),          // next 14 days
  predictions: activePredictions(3),  // next 7 days
  academicAlerts: examEvents(7),      // next 7 days
}
// total: ~2,500–3,000 tokens regardless of data volume
```

### 9.2 Output structure

```typescript
{
  headline:          string,  // ≤ 12 words, single most important thing
  key_risk:          string,  // primary concern today
  key_opportunity:   string,  // best leverage point today
  important_event:   string,  // highest-priority upcoming event
  recommended_action: string, // single most impactful action
  sources: { type, id, date }[]  // attribution
}
// Maximum output: 150 words
```

---

## 10. Implementation Phases

This spec covers the full architecture. Implementation is split into sub-projects, each with its own implementation plan.

| Phase | Sub-project | Depends on |
|---|---|---|
| 1 | Memory Foundation: schema migration + cursor infrastructure | — |
| 2 | Fact Extraction + Feature Vectors: deterministic pipeline | Phase 1 |
| 3 | Semantic Memory: pgvector + embeddings for all layers | Phase 1 |
| 4 | Pattern Engine: correlations, anomalies, seasonality, success patterns | Phase 2 |
| 5 | Insight Records + Knowledge Graph: promotion, decay, conflict detection | Phase 4 |
| 6 | Predictive Intelligence: prediction records + evaluation loop | Phase 5 |
| 7 | Intelligence UI: briefing redesign, query interface, insight feed | Phase 6 |
| 8 | New Data Sources: academic events, study sessions, outcomes, confidence logs | Phase 1 |

Phases 3 and 8 can run in parallel with Phase 2.

---

## 11. Files to Create / Modify

| File | Change |
|---|---|
| `lib/embeddings.ts` | New: Voyage AI batch embedding utility |
| `lib/memory.ts` | New: unified retrieval API with budgets + ranking |
| `lib/pipeline/facts.ts` | New: deterministic fact extraction |
| `lib/pipeline/features.ts` | New: feature vector generation + composite scores |
| `lib/pipeline/patterns.ts` | New: statistical analysis + correlation candidates |
| `lib/pipeline/insights.ts` | New: insight promotion, decay, conflict detection |
| `lib/pipeline/predictions.ts` | New: prediction generation + evaluation |
| `lib/pipeline/summaries.ts` | New: daily/weekly/monthly summary generation |
| `lib/jobs.ts` | Extend: cursor-based stage orchestration |
| `lib/prompts.ts` | Extend: new structured output tools for all stages |
| `lib/anthropic.ts` | Unchanged |
| `lib/scores.ts` | Extend: composite score formulas |
| `app/api/cron/daily/route.ts` | Extend: orchestrate new pipeline stages |
| `extra-schema.sql` | Extend: all new tables |

---

## 12. Key Design Decisions

| Decision | Rationale |
|---|---|
| Cursor-based incremental processing | O(new data) cost; handles backfill and failures cleanly |
| Statistics before LLMs | Cheaper, faster, more reliable for mathematical relationships |
| Sonnet never reads raw rows | Token cost stays constant as years accumulate |
| Haiku for extraction/classification | ~20× cheaper than Sonnet; appropriate for deterministic tasks |
| pgvector HNSW over IVFFlat | Better recall at low ef_search; no training step needed |
| voyage-3 at 1024 dims | Already integrated; strong semantic quality; matches existing schema |
| Postgres edge table for graph | Zero additional infra; queryable with SQL; sufficient for this use case |
| Insight promotion thresholds | Prevents noise from becoming "insights"; maintains Layer 6 quality |
| Insight decay with predictive accuracy | Insights that make bad predictions lose authority; system self-corrects |
| Retrieval diversity filter | Prevents context being filled with near-duplicate records |
| Source attribution throughout | Every claim is traceable; enables explainability UI |
