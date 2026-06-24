# Briefing — Apple-Health-Inspired Rebuild Implementation Plan

> **STATUS (2026-06-23): ALL 7 PHASES IMPLEMENTED & DEPLOYED ✅.** This is the full original plan, kept for reference. For live status (commit hashes, what's left, deploy rules) see **`.claude/handoff.md`** — the source of truth. Remaining/optional: 6M/Y trend ranges, year-comparison highlight card, per-sender Articles filtering, deeper PWA/IPA wrap.

> **For agentic workers:** the plan was executed one-phase-per-turn. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the app's navigation and core tabs to match Apple Health's *structure and curved aesthetic* — rendered in the existing Circadian-Glass design system — adding Trends, Observations, Inputs, and Articles tabs alongside the existing Summary/briefing, with a zero-LLM-token charting path and a zero-token email-fed Articles reader.

**Architecture:** Extend the existing Next.js (App Router) + Tailwind v4 + Neon + Anthropic stack. **All trends/averages/comparisons are computed in SQL/JS — never the LLM.** AI writes only short observations from a fixed-size summary. Reuse existing DB tables (`oura_daily`, `intake_log`, `reflections`, `briefings`) rather than creating the parallel tables named in the spec; add only genuinely new tables (`observations`, `sources`, `articles`).

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 (`@theme` tokens in `app/globals.css`) · Neon Postgres (`@/lib/db` `sql` tagged template) · Anthropic SDK (`@/lib/anthropic`) · Vercel Cron (`vercel.json`) · PWA via `next-pwa`. New deps for Articles: `imapflow`, `mailparser`, `sanitize-html` (+ `@types/sanitize-html`).

---

## Global Constraints (apply to every phase)

- **Target device:** iPhone 15 Pro Max (~430×932pt @3x). Use `env(safe-area-inset-*)`, `display: standalone`, touch targets ≥ 44pt. PWA now, IPA (Capacitor) later.
- **Token cost flat:** charts render only from numbers computed in SQL/JS. AI never sees raw rows; only a fixed-size summary. **Articles use ZERO AI tokens.**
- **No second design system.** Reuse existing tokens/primitives in `app/components/ui/*` and `app/globals.css`. Replace a file only when genuinely superseded, and say so.
- **Do NOT delete working code** (Oura integration, morning briefing, Neon access, intelligence pipeline in `lib/pipeline/*`, auth, push).
- **No subagents / no `Agent` tool** — work inline (standing user rule in `.claude/handoff.md`).
- Files under 500 lines. Read before editing. SQL via `` sql`...` `` from `@/lib/db`. Single user: `USER_ID = 1` from `@/lib/jobs`. Validate input at API boundaries. No secrets in repo/client.
- No `Co-Authored-By` trailer on commits (project `settings.json` has no `attribution.commit`).
- **Identity (confirmed with user):** accent **teal `#14b8a6`**; **keep SF Pro Rounded** (do not switch to Geist). Dark elevated glass surfaces, `rounded-card` (20px), curved/floating chrome.

---

## Context — why this change

The repo is an existing personal-health PWA ("Circadian Glass") with a morning briefing, an Oura sync + intelligence pipeline, reflections, and intake logging. The spec (`.claude/briefing-build-spec.md`) directs a redesign of the **navigation and tab structure** to mirror Apple Health's layout/interaction (used purely as a reference — not its orange/blue palette or SF Pro), delivering five tabs: **Summary, Trends, Observations, Inputs, Articles**. Trends and Articles are new surfaces; Observations and Inputs largely re-skin existing reflection/logging features; Summary keeps the current briefing. The Articles feature is a newsletter reader fed by a dedicated mailbox (no AI). Reference screens: `.claude/IMG_0866–0875` (Apple Health).

### Existing → spec reconciliation (decided)

| Spec name | Reuse / create | Notes |
|---|---|---|
| `health_days` | **Reuse `oura_daily`** | typed: `day, sleep_score, readiness_score, hrv_avg, resting_hr, total_sleep_seconds`; `raw_payload` jsonb holds `activity_score, steps, active_calories, rem/deep/light_sleep_seconds`. |
| `logs` (caffeine/alcohol) | **Reuse `intake_log`** | `(id, user_id, type, quantity, unit, timestamp, note)`; already supports `caffeine` (mg) + `alcohol` (drinks) via `/api/log/intake`. |
| `reflections(date, body)` | **Reuse `reflections`** | columns are `entry_date`, `raw_text` (+ `reflection_metadata`). |
| Summary source | **Reuse `briefings`** + `generateBriefing()` in `lib/jobs.ts`. | |
| `observations` | **Create** | not present; small table per spec. |
| `sources`, `articles` | **Create** | not present; new feature. |

**`computeTrends` metric → column map (no LLM):**
`readiness→readiness_score` · `sleep_score→sleep_score` · `sleep_hours→total_sleep_seconds/3600.0` · `hrv→hrv_avg` · `resting_hr→resting_hr` · `activity_score→(raw_payload->>'activity_score')::numeric` · `steps→(raw_payload->>'steps')::numeric` · `active_cal→(raw_payload->>'active_calories')::numeric`.

### Reusable primitives (already in repo)

- `app/components/ui/`: `GlassCard`, `SolidCard`, `MetricCard`, `TrendChart` (line+scrub — **keep; do not clobber**), `Sparkline`, `Ring`, `ChartContainer`, `Skeleton`, `Button`, `TopHeaderRow`, `CalendarHeatmap`, `CorrelationBar`, `ReadinessContributors`, `SleepStageBar`.
- `app/components/TabBar.tsx` (frosted floating bar, scroll-hide, `chipStyle` factory), `MoreSheet.tsx`, `CircadianBackground.tsx`, `StatusBar.tsx`.
- `lib/`: `db.ts` (`sql`), `jobs.ts` (`USER_ID`, `userTz`, `generateBriefing`), `oura.ts` (`syncOura`), `dates.ts` (`localDateStr`, `daysAgoStr`), `anthropic.ts` (`extractWithTool`, `HAIKU_MODEL`), `prompts.ts`, `correlations.ts`.

---

## Cross-cutting Phase 0 (fold into Phase 1's first commit): Teal token retune

- **Modify `app/globals.css`:** set `--color-accent: #14b8a6` and `--color-accent-dim: #0f9b8e` in both `@theme` and `:root` (and the light-mode block). Retune accent glows that hardcode blue RGB: `--shadow-glow` and the `60,130,246`/`59,130,246` values → teal `20,184,166`. Update `--accent: #14b8a6` (legacy var). **Leave fonts unchanged** (SF Pro Rounded stays).
- Verify nothing else hardcodes `#3b82f6` for accent UI: `Grep "3b82f6|59,130,246|94,150,247"` and convert accent (not data-viz semantic) usages to the token.

---

## Phase 1 — Foundation: schema, `computeTrends`, teal tokens

**Delivers:** new tables, the trend engine with tests, teal accent. No UI yet.

**Files:**
- **Append to `extra-schema.sql`** (repo root, existing additive-schema file — do NOT create a new `db/` file) — a new `-- ===== Briefing tabs =====` section with `observations`, `sources`, `articles` DDL (below). Apply by pasting the new section into the Neon SQL editor (user task).
- Create `lib/trends.ts` — `computeTrends`.
- Create `lib/trends.test.ts` (or `scripts/trends-check.ts` if no test runner is wired — verify with `npx tsx`).
- Modify `app/globals.css` (Phase 0 token retune).

**New table DDL (append to `extra-schema.sql`):**
```sql
CREATE TABLE IF NOT EXISTS observations (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
  range_start DATE NOT NULL, range_end DATE NOT NULL,
  body TEXT NOT NULL, model TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS observations_user_created ON observations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('rss','email')),
  identifier TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY, source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  guid TEXT UNIQUE NOT NULL, title TEXT NOT NULL, image_url TEXT,
  description TEXT, body_html TEXT, published_at TIMESTAMPTZ,
  original_url TEXT, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS articles_source_published ON articles(source_id, published_at DESC);
```

**`lib/trends.ts` interface (Produces — relied on by Phases 4 & 6):**
```ts
export type TrendMetric = 'readiness'|'sleep_score'|'sleep_hours'|'hrv'|'resting_hr'|'activity_score'|'steps'|'active_cal';
export type TrendRange = 'D'|'W'|'M';        // D=14d daily, W=7d, M=trailing 30d (NOT calendar month)
export type TrendPoint = { date: string; value: number | null };
export type TrendResult = {
  metric: TrendMetric; points: TrendPoint[];
  average: number; prevAverage: number; delta: number;
  direction: 'up'|'down'|'flat'; daysAbove: number; daysBelow: number; unit: string;
};
export async function computeTrends(metric: TrendMetric, range: TrendRange, userId?: number): Promise<TrendResult>;
```
- Pure SQL/JS. `average` over the window; `prevAverage` over the preceding equal window (baseline); `delta = average − prevAverage`; `direction` by sign with a small flat band; `daysAbove`/`daysBelow` = count of window points above/below `prevAverage`. Map metric→column per table above; `sleep_hours` divides seconds by 3600; jsonb metrics via `(raw_payload->>'…')::numeric`.

**Steps (TDD):**
- [ ] Write failing tests for `computeTrends`: average/prevAverage/delta/direction and daysAbove/daysBelow on a seeded fixture (mock `sql` or use a local array path). Cover the `sleep_hours` seconds→hours conversion and the jsonb `steps` extraction.
- [ ] Run tests → fail.
- [ ] Implement `lib/trends.ts`; apply teal token retune in `globals.css`.
- [ ] Run tests → pass; `npx tsc --noEmit` clean.
- [ ] Commit: `feat(trends): computeTrends engine, briefing schema, teal accent token`.

**Verification:** `npx tsc --noEmit`; tests green; `npm run build`. User applies `db/briefing-schema.sql` in Neon.

---

## Phase 2 — Bottom TabBar: five tabs replacing the current set

**Delivers:** new 5-tab navigation + route skeletons; existing pages still reachable.

**Tab set (replaces `TABS` in `app/components/TabBar.tsx`):**
1. **Summary** → `/dashboard` (existing briefing — unchanged).
2. **Trends** → `/trends` (new skeleton page).
3. **Observations** → `/observations` (new skeleton page).
4. **Inputs** → `/log` (existing logging route, relabeled — minimal churn).
5. **Articles** → `/articles` (new skeleton page).

**Files:**
- Modify `app/components/TabBar.tsx`: replace the 4-item `TABS` + More button with **exactly 5** identical chips (reuse existing `chipStyle`, `CHIP_CLASS`, `ActiveDot`). Provide Briefing's own teal-stroke icons (summary/sparkline, trends/bars, observations/insight, inputs/plus-circle, articles/cards). Remove the More chip (iOS-max 5 reached; spec says overflow only "if ever needed").
- Secondary destinations (`/weekly`, `/insights`, `/settings`): keep routes; surface `/settings` via a gear in the Summary header (`TopHeaderRow`); link `/weekly` + `/insights` from within Trends/Observations "history" affordances. Keep `MoreSheet.tsx` in the tree (unused by the bar) — do not delete.
- Create skeleton pages: `app/trends/page.tsx`, `app/observations/page.tsx`, `app/articles/page.tsx` (header + `Skeleton` placeholders), each rendered inside existing layout so the TabBar + `CircadianBackground` + safe-area insets apply.

**Steps:**
- [ ] Add the three skeleton route pages; confirm they render with TabBar + safe-area.
- [ ] Rewrite `TABS` to the five entries with teal icons; ensure active-state logic (`path === href || startsWith`) maps `/` → Summary.
- [ ] Add settings gear to Summary header; verify `/settings` reachable.
- [ ] `npm run build`; manual check on iPhone 15 Pro Max viewport (430px) that all five chips are pixel-identical and clear the home indicator.
- [ ] Commit: `feat(nav): five-tab bottom bar (Summary/Trends/Observations/Inputs/Articles)`.

**Verification:** load each tab in a 430px viewport; confirm no horizontal overflow, equal chip footprint, safe-area bottom padding, scroll-hide still works.

---

## Phase 3 — Inputs tab (caffeine slider + alcohol counter)

**Delivers:** the Inputs surface writing to `intake_log` via the existing `/api/log/intake`.

**Refs:** curved buttons/cards; Apple action-card styling (`IMG_0872`).

**Files:**
- Create `app/components/inputs/CaffeineSlider.tsx` — horizontal scrollable slider, **25 mg steps** (0,25,50,…, cap ~600); large value readout; confirm button. `props: { step?: number; onConfirm(mg:number):void }`.
- Create `app/components/inputs/AlcoholCounter.tsx` — −/＋ stepper for drink count + confirm. `props: { onConfirm(drinks:number):void }`.
- Create `app/components/inputs/LogButton.tsx` — shared curved confirm button (or reuse `ui/Button`).
- Modify `app/log/page.tsx` / `app/log/LogTab.tsx`: mount the new components; relabel surface "Inputs". Keep existing today's-entries list + weekly stats (reuse). POST `{type:'caffeine', quantity, unit:'mg'}` / `{type:'alcohol', quantity, unit:'drinks'}` to `/api/log/intake` (already validates + inserts). Timestamp = device time (route default).

**Steps:**
- [ ] Build `CaffeineSlider` (snap to 25mg) + test the snap math.
- [ ] Build `AlcoholCounter`.
- [ ] Wire both into LogTab; confirm rows appear in today's list after POST (existing GET refresh).
- [ ] `npm run build`; manual: log 50mg caffeine + 2 drinks, verify `intake_log` rows + weekly stat updates.
- [ ] Commit: `feat(inputs): caffeine slider (25mg) + alcohol counter on Inputs tab`.

**Verification:** POST → 201, row visible, weekly caffeine/alcohol totals reflect it.

---

## Phase 4 — Trends tab (highlight cards + detail view)

**Delivers:** the core Apple-Health interaction — highlight cards per metric + tap-through detail with D/W/M selector. All from `computeTrends`; no AI.

**Refs:** `IMG_0866/0869` (highlight + year comparison), `IMG_0868` (detail + D/W/M/6M/Y selector, circled — we ship **D/W/M**; 6M/Y later), `IMG_0871` (stat tiles).

**Files (components):**
- `app/components/trends/MetricHighlightCard.tsx` — flame/teal metric label + headline sentence ("The last 7 days, your {metric} averaged {avg} {unit}…"), mini bar chart with **teal average line** over gray bars, single-letter day labels (T W T F S S M), big value + unit, `daysAbove/daysBelow of 7`. Tap → detail.
- `app/components/trends/MetricBarChart.tsx` — **new** bar chart (existing `TrendChart` is a line — do not reuse): thin gray (or teal in detail) bars, dashed vertical gridlines, right-axis value labels (e.g. 0/200/400), day labels under bars, optional teal horizontal average line. SVG, viewBox-scaled, touch scrub optional. `props: { points:number[]; labels:string[]; average?:number; accent?:boolean }`.
- `app/components/trends/TimeRangeToggle.tsx` — segmented control D/W/M (dark pill track, selected = lighter elevated pill), reusing token shadows. `props: { value:TrendRange; onChange }`.
- `app/components/trends/MetricDetailView.tsx` — segmented control + "AVERAGE" eyebrow + big value + date-range subtitle + full `MetricBarChart` (gridlines + day labels) + Trend pill (hairline `rounded-full`, label left/value right).
- `app/components/trends/TrendPill.tsx` — hairline-bordered pill.
- `app/trends/page.tsx` — server component: for each tracked metric call `computeTrends(metric,'W')`, render a `Highlights` header + stacked `MetricHighlightCard`s. Detail opens via client state or `/trends/[metric]` route.

**Data:** read via `computeTrends` (Phase 1). Date-range subtitle from `points[0].date`–`points[n].date` formatted with `lib/dates`. **M = trailing 30 days.**

**Steps:**
- [ ] Build `MetricBarChart` + visual check against `IMG_0868` (gridlines, right-axis labels, day labels).
- [ ] Build `TimeRangeToggle` + `TrendPill`.
- [ ] Build `MetricHighlightCard` (mini bars + average line) per `IMG_0866`.
- [ ] Build `MetricDetailView`; wire tap-through from highlight → detail with D/W/M switching (re-calls `computeTrends`).
- [ ] `app/trends/page.tsx` renders real Oura data; `npm run build`.
- [ ] Commit: `feat(trends): highlight cards + D/W/M detail view from computeTrends`.

**Verification:** with seeded `oura_daily`, the highlight card sentence + daysAbove/Below match `computeTrends`; switching D/W/M re-renders bars + average + date subtitle; no network calls to Anthropic.

---

## Phase 5 — Articles tab (email ingestion + in-app reader + Sources manager)

**Delivers:** zero-token Articles feature: dedicated-mailbox IMAP ingestion (poll on cron + pull-to-refresh), list, in-app reader (never leaves the app), Sources manager. Cap = latest 5.

**Refs:** `IMG_0873` (list), `IMG_0874` (reader), `IMG_0875` (body w/ pills + "Learn more" links).

**Decided with user:** **IMAP + Gmail app password**; fill the mailbox via **auto-forwarding** from the main inbox (not direct subscribe). I will provide a setup walkthrough / a reputable online guide; user supplies the dedicated email + app password into server secrets.

**Deps:** add `imapflow`, `mailparser`, `sanitize-html`, `@types/sanitize-html`.

**Files:**
- `lib/articles/ingest.ts` — `ingestEmail(userId)`: connect IMAP (env: `NEWSLETTER_IMAP_HOST`, `NEWSLETTER_IMAP_USER`, `NEWSLETTER_IMAP_PASS`), fetch unseen, parse via `mailparser` (subject→`title`; first sizable non-tracking inline image→`image_url`; preheader/first paragraph→`description`; **sanitized HTML→`body_html`**), dedupe by `Message-ID`→`guid` (insert new, skip existing), best-effort strip footer/unsubscribe/ad chrome.
- `lib/articles/sanitize.ts` — wrap `sanitize-html` (strip scripts/tracking pixels/unsafe tags; allow img/p/h/ul/a).
- `app/api/articles/route.ts` — GET latest 5 (`ORDER BY published_at DESC LIMIT 5`).
- `app/api/articles/refresh/route.ts` — POST → `ingestEmail` (pull-to-refresh), returns new count.
- `app/api/sources/route.ts` — GET/POST/PATCH/DELETE for `sources` (add/remove/toggle).
- `app/components/articles/ArticleList.tsx`, `ArticleCard.tsx` (image banner rounded-top + title/description on dark lower half per `IMG_0873`), `ArticleReader.tsx` (**in-app modal**: hero image + close X + big title + body from `body_html`; per `IMG_0874/0875`; segmented pills + body styling; **in-article links open in an in-app sheet/`<iframe>` or in-app browser — never `window.open` to Safari**), `SourcesManager.tsx`.
- `app/articles/page.tsx` — list + pull-to-refresh; reader as overlay.
- `app/settings/sources/page.tsx` (or section) — mount `SourcesManager`.
- Modify `app/api/cron/daily/route.ts` (or `lib/jobs.ts:runDailyJob`) to call `ingestEmail(USER_ID)` daily.

**Interactive setup (with user, during this phase):** create the dedicated Gmail; enable 2FA + generate app password; set an auto-forward filter in the main inbox for newsletter senders; add IMAP creds to Vercel/`.env` secrets; verify articles flow in. Stub creds with `// TODO` until provided.

**Steps:**
- [ ] Add deps; build `sanitize.ts` + test (script tag stripped, img kept).
- [ ] Build `ingest.ts`; unit-test the parser on a sample `.eml` (title/image/description/body extraction + dedupe).
- [ ] Build API routes (`articles`, `articles/refresh`, `sources`) with boundary validation.
- [ ] Build `ArticleCard`/`ArticleList`/`ArticleReader` (in-app only) + `SourcesManager`; `app/articles/page.tsx` with pull-to-refresh.
- [ ] Wire ingestion into daily cron.
- [ ] Walk user through mailbox + auto-forward + secrets; verify real article ingests and renders fully in-app.
- [ ] `npm run build`; commit: `feat(articles): IMAP newsletter ingestion + in-app reader + Sources manager`.

**Verification:** sample `.eml` → one `articles` row, sanitized body, no script tags; list shows ≤5 newest; tapping opens in-app reader; tapping an in-article link stays in-app; pull-to-refresh + cron both ingest; dedupe skips repeats.

---

## Phase 6 — Observations tab (reflections + AI observation)

**Delivers:** interwoven user reflections + AI interpretation from a fixed-size summary; stored in `observations`.

**Files:**
- `app/components/observations/ReflectionComposer.tsx` — writes to `reflections` via existing `/api/reflections` (reuse).
- `app/components/observations/ObservationCard.tsx` — rounded card; renders an AI observation or a reflection, visually distinguished.
- `app/api/observations/route.ts` — GET latest + history; POST "Generate observation": assemble a **fixed-size summary** (today's `computeTrends` deltas for key metrics + latest `daily_summaries` row + recent `reflections`), call `extractWithTool` (new `observationTool` in `lib/prompts.ts`) → store in `observations` (`range_start/range_end/body/model`). **AI sees only the compact summary, never raw rows.**
- `app/observations/page.tsx` — composer + interleaved history (reflections + observations) newest-first.

**Steps:**
- [ ] Add `observationTool` to `lib/prompts.ts`; build the fixed-size summary assembler.
- [ ] Build `app/api/observations/route.ts` (GET/POST) with validation.
- [ ] Build `ReflectionComposer` (reuse reflections API) + `ObservationCard` + page.
- [ ] `npm run build`; manual: add a reflection, generate an observation, confirm `observations` row + render.
- [ ] Commit: `feat(observations): reflection composer + AI observation from fixed summary`.

**Verification:** generate observation issues exactly one Anthropic call with a bounded prompt (log token count); reflections + observations interleave correctly.

---

## Phase 7 — Polish & PWA

**Delivers:** icons, transitions, standalone PWA correctness, IPA-wrap prep.

**Files:** `public/manifest.json` (standalone, theme/background color → teal/black, icons), service worker cache bump, `app/layout.tsx` (`viewport-fit=cover`, theme-color), per-tab page-enter transitions (reuse `.page-enter`, `.animate-*`), consistent Briefing teal icon set across tabs.

**Steps:**
- [ ] Audit safe-area insets on every tab (Dynamic Island top, home indicator bottom).
- [ ] Finalize manifest + standalone; verify "Add to Home Screen" launches chromeless.
- [ ] Bump SW cache version; verify update.
- [ ] `npm run build`; Lighthouse PWA pass; commit: `feat(pwa): manifest, transitions, safe-area polish`.

**Verification:** installed PWA on iPhone launches standalone, no browser chrome, all tabs respect insets.

---

## Overall verification

- `npx tsc --noEmit` clean and `npm run build` succeeds after every phase.
- `computeTrends` unit tests green; charts contain **no** Anthropic calls (grep the trends/articles paths).
- Manual device-width (430px) walkthrough of all five tabs.
- Articles render fully in-app; no external navigation.
- One Anthropic call per observation, bounded prompt size.

## User setup tasks (cannot be automated)

1. Paste the new `-- ===== Briefing tabs =====` section of `extra-schema.sql` into the Neon SQL editor and run it (Phase 1).
2. Create dedicated Gmail + 2FA + app password; add auto-forward filter; add `NEWSLETTER_IMAP_*` secrets to Vercel + `.env` (Phase 5) — I'll walk you through it.

## Open visual notes (from refs, flag if ambiguous)

- Apple's orange flame / blue links → **teal `#14b8a6`**; "Low" pill stays rose (`--color-rose`).
- Detail chart ships **D/W/M** only (6M/Y deferred per spec).
- Year-comparison highlight card (`IMG_0866`) needs ≥1 year of data; if absent, hide that card rather than show empty bars.
