# app/api/ — server endpoints

Conventions: validate input at the boundary; SQL via `@/lib/db` only; auth-protected routes are
matched in root `proxy.ts`. Cron routes check `CRON_SECRET`.

| Route | Purpose |
|---|---|
| `academic/{events,outcomes,study}` | Academic tracking — calendar-derived events, grades/outcomes, study logs |
| `articles`, `articles/refresh` | List articles / trigger IMAP newsletter ingest (`lib/articles/ingest`) |
| `sources` | Newsletter source list (informational — per-sender filtering not built) |
| `auth/{login,logout}` | Password session create/destroy (`lib/auth`) |
| `auth/webauthn/{register,login}/{options,verify}` | Passkey (WebAuthn) ceremonies |
| `briefing/run` | Generate the daily briefing on demand (`lib/jobs.generateBriefing`) |
| `calendar` | ICS calendar feed sync (`lib/calendar`) |
| `cron/daily` | Vercel cron: Oura sync, briefing, articles ingest, pipeline advance |
| `cron/nudge` | Vercel cron: push nudges, gated by `lib/notify-timing` quiet hours |
| `export` | Data export |
| `goals`, `habits` | Goal / habit CRUD |
| `insights/ask` | "Ask your data" — single bounded AI call with SQL-built snapshot grounding |
| `log/{intake,mood,weight,confidence}` | Manual logging (caffeine+alcohol, mood, weight, confidence) |
| `observations` | GET list / POST = one bounded Anthropic call writing an observation |
| `oura/{connect,callback}` | Oura OAuth flow |
| `oura`, `oura/webhook` | Oura data fetch / webhook receiver |
| `push/{subscribe,vapid-key}` | Web-push subscription management |
| `reflections`, `reflections/search` | Journal reflections CRUD / embedding-based search (`lib/embeddings`) |
| `settings` | User settings |
| `trends` | Metric trend data via `lib/trends.computeTrends` |
