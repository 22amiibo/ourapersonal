# Project Status & Handoff — Briefing (Oura PWA)

**Last updated:** 2026-06-23 · **Read this first every session.**

This file is the single source of truth for project state. If you are a fresh chat, read this top-to-bottom before doing anything.

---

## What this project is
"Briefing" — a personal-health PWA for one user. Apple-Health-inspired UI rendered in a custom "Circadian Glass" design system.
- **Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 (`@theme` tokens in `app/globals.css`) · Neon Postgres (`@/lib/db` → `sql` tagged template) · Anthropic SDK (`@/lib/anthropic`) · Vercel + Vercel Cron · PWA via `next-pwa`.
- **Single user:** `USER_ID = 1` (`@/lib/jobs`). Timezone via `userTz()`.
- **Local path:** `C:\Users\Administrator\Oura\repo`. **GitHub:** `22amiibo/ourapersonal`.

## Working rules (do not violate)
- **No subagents / no `Agent` tool.** Work directly and inline.
- **No `Co-Authored-By` trailers** on commits.
- Read a file before editing. Keep files < 500 lines. Validate input at API boundaries.
- SQL only via `import { sql } from "@/lib/db"` (neon tagged templates).
- Never commit secrets. Server-only secrets stay in `.env` / Vercel env vars.
- Reuse existing primitives in `app/components/ui/*`; don't build a parallel design system.

---

## The build (current major effort) — Apple-Health 5-tab rebuild
**Spec:** `.claude/briefing-build-spec.md` · **Full plan (in repo):** `.claude/implementation-plan.md` (phase-by-phase detail)
**Reference screenshots:** `.claude/IMG_0866`–`0875` (Apple Health, layout reference only — NOT its palette/font).

**Locked design decisions:** accent **teal `#14b8a6`** (`--color-accent`); keep **SF Pro Rounded** (NOT Geist). Articles ingestion = **IMAP + Gmail app password**, mailbox filled by **auto-forwarding**.

### Status: ALL 7 PHASES IMPLEMENTED & DEPLOYED ✅ (Production ● Ready on Vercel)
Verification each phase: `npx tsc --noEmit` clean · `npm test` 11/11 · `npm run build` green.

| Phase | Commit | Delivered |
|---|---|---|
| 1 Foundation | `2418193` | `lib/trends.ts` `computeTrends(metric,range)` (pure SQL/JS, zero LLM) + `lib/trends.test.ts` (11 tests) + teal token retune |
| 2 Nav | `f7cb741` | 5-tab `TabBar` (Summary/Trends/Observations/Inputs/Articles); `MoreButton` gear in Summary header → Settings/Weekly/Insights |
| 3 Inputs | `ea3ea3c` | `CaffeineSlider` (25mg) + `AlcoholCounter` in `app/log/LogTab.tsx` → `/api/log/intake` |
| 4 Trends | `5752ca5` | `MetricBarChart`/`MetricHighlightCard`/`MetricDetailView`/`TimeRangeToggle`/`TrendPill` + `/api/trends` |
| 5 Articles | `7126bf9` | `lib/articles/{ingest,sanitize}.ts`, `/api/articles`,`/api/articles/refresh`,`/api/sources`, reader/card/manager, wired into `runDailyJob` |
| 6 Observations | `5e9daae` | `/api/observations` (POST = 1 bounded Anthropic call), `observationTool`, composer + cards |
| 7 PWA | `0db45c4` | SW cache bump |

### Key architecture facts (don't re-derive)
- **Token cost is flat:** all trends/averages computed in SQL/JS. AI writes only observations from a fixed-size summary. **Articles use ZERO AI tokens.**
- **Existing tables reused** (spec names → actual): `health_days`→**`oura_daily`** (typed: sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds; jsonb `raw_payload` holds activity_score/steps/active_calories) · `logs`→**`intake_log`** · `reflections`→**`reflections`** (cols `entry_date`,`raw_text`) · Summary→**`briefings`**.
- **New tables** (in `extra-schema.sql`, `-- ===== Briefing tabs =====` section): `observations`, `sources`, `articles`.
- `computeTrends` ranges: D=14d, W=7d, M=trailing-30d (NOT calendar month). DB import is lazy so the pure math is unit-testable; tests run via `npm test` (tsx + node:test).
- Caveat: Articles ingest scans the whole mailbox and files everything under one auto-created email source; the Sources screen is informational (per-sender filtering = future enhancement).

### Remaining / optional plan work
- 6M/Y ranges on Trends detail (only D/W/M shipped).
- Year-comparison highlight card (`IMG_0866`) — needs ≥1yr data; deferred.
- Per-sender Articles filtering via the Sources list.
- Deeper PWA polish / IPA (Capacitor) wrap.

### Pending USER setup (app deploys but tabs show empty states until done)
1. **Neon:** run the `-- ===== Briefing tabs =====` section of `extra-schema.sql` in the Neon SQL editor.
2. **Vercel env vars:** `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CRON_SECRET` (required) + `NEWSLETTER_IMAP_USER`, `NEWSLETTER_IMAP_PASSWORD` (Articles; optional `NEWSLETTER_IMAP_HOST`/`_PORT`).
3. Create dedicated newsletter Gmail (2FA + app password + enable IMAP); auto-forward newsletters to it.
4. Connect + sync Oura so Trends/Summary have data.

---

## DEPLOYMENT — read before pushing
Vercel project **`ourapersonal`** (team `22amiibos-projects`). Production is currently ● Ready.

**Three gotchas already fixed — keep them fixed:**
1. **Git author email MUST be `2wohundredamiibo2@gmail.com`** (the Vercel account email). It's set repo-local (`git config user.email`). If commits are authored by any other email (e.g. `nomartzdc@gmail.com`), Vercel marks the deploy **"Blocked"** and it never builds. Do NOT change this.
2. **Branch mismatch:** dev happens on **`master`**; Vercel's built/default branch is **`main`**. They are kept in sync. **To deploy, push to BOTH:**
   ```
   git push origin master && git push origin master:main
   ```
   (normal fast-forwards — no `--force` needed). Optionally set Vercel Production Branch to `master` (Settings → Environments → Production → Branch Tracking) to simplify to a single `git push`.
3. **Untracked source files** silently break Vercel (local builds pass, CI fails module-not-found). After large sessions run `git status` and commit any untracked `.tsx`/`.ts` before relying on a deploy.

**Useful:** Vercel CLI is installed and authed as `22amiibo`. `npx vercel ls` (recent deploys), `npx vercel inspect --logs <url>` (build logs). Do NOT rely on `vercel --prod` from a background shell — it hangs on prompts.

**Verify a deploy:** `npx vercel ls` → newest row should be `Production ● Ready`.

---

## Repo hygiene note
Repo root has stray empty junk files from earlier shell mishaps (`,`, `0`, `55)`, `path`, `bg-bg-soft`, `number`, `teal`, `v4`, `${weekAgo}`, `git`). They are not source and are safe to delete; left untouched so far.
