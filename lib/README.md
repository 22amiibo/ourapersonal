# lib/ — server & shared logic

Rules: SQL only via `sql` from `db.ts`; AI only via `anthropic.ts`; single user (`USER_ID = 1`,
`userTz()` in `jobs.ts`). Pure logic is kept DB-free so it can be unit-tested (`*.test.ts`,
run with `npm test`).

| Module | What it is |
|---|---|
| `db.ts` | Neon Postgres client — exports the `sql` tagged template. Only DB entry point. |
| `jobs.ts` | The orchestrator: `USER_ID`, `userTz()`, `generateBriefing()`, `weeklyRollup()`, daily-job wiring. Most modules hang off this. |
| `anthropic.ts` | Anthropic SDK client wrapper. All AI calls go through here — bounded, one-shot. |
| `prompts.ts` | System prompts + tool schemas (briefing, reflection extraction, observations). |
| `trends.ts` | `computeTrends(metric, range)` — pure SQL/JS metric aggregation (D=14d, W=7d, M=trailing-30d). Zero LLM. Tested. |
| `achievements.ts` | Awards catalog + evaluator (20 awards) — pure SQL/JS, zero AI. Tested. |
| `scores.ts` | Score→zone mapping (`optimal/good/attention/low`) + zone colors/labels. Tested. |
| `oura.ts` | Oura API integration — OAuth tokens, data sync into `oura_daily`. |
| `auth.ts` | Session cookie create/verify (+ legacy sessions), WebAuthn helpers. Used by `proxy.ts`. |
| `crypto.ts` | AES encryption for tokens at rest, keyed from `AUTH_SECRET`. |
| `articles/ingest.ts` | IMAP newsletter ingestion (imapflow + mailparser) → `articles` table. Zero AI tokens. |
| `articles/sanitize.ts` | HTML sanitization for the article reader. |
| `calendar.ts` | ICS feed sync + free (no-AI) title-based event classification (exam/assignment/event). |
| `correlations.ts` | `computeCorrelations()` — SQL-side metric correlations (mood × readiness etc.). |
| `correlation-utils.ts` | Pure types + `formatInsight()` for correlations (DB-free, testable). |
| `embeddings.ts` | Voyage AI REST embeddings (1024-dim, voyage-3) + pgvector literal helpers. |
| `memory.ts` | Context-aware retrieval for AI grounding — retrieval budgets, query intent, record selection. |
| `push.ts` | web-push sender (VAPID). |
| `notify-timing.ts` | Timezone-aware quiet-hours gating so cron pushes never land at night. |
| `motion.ts` | Client-side motion helpers — reduced-motion, once-per-session reveal gate, count-up. SSR-safe. |
| `dates.ts` | Date/timezone utilities (most-imported module after `db`). |

## pipeline/ — incremental intelligence pipeline
Cursor-based stages advanced by the daily cron (each tracks progress in the DB via
`facts.ts` cursors): `facts.ts` (cursor plumbing + fact extraction) → `features.ts` →
`patterns.ts` → `predictions.ts` → `insights.ts` → `summaries.ts`. Entry point: `lib/jobs.ts`.
