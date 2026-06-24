# Briefing — Build Spec & Agent Prompt

## How to use this (read first, agent)
- Read this entire spec **and** the reference images `IMG_0866`–`IMG_0875` (view the images directly; this prose alone will not reproduce the look).
- The images are **Apple Health, used as layout/interaction reference**. The Articles screens are now real features (see map); the Mental Health Questionnaire screen is a **styling reference only** unless told otherwise.
- **Identity:** do NOT copy Apple's orange/blue palette or SF Pro. Match Apple Health's **structure and curved aesthetic**, rendered in Briefing's system: teal accent, Geist fonts, dark elevated surfaces, `rounded-2xl` cards, safe-area insets, Briefing's own icon set.
- **Before writing any code, produce a detailed phased implementation plan**: list phases, what each delivers, and dependencies. Then implement **one phase per turn** and stop for review after each.

## Working with the existing codebase (Phase 1)
- This is an **existing app**. Do NOT delete working code (Oura integration, morning briefing, Neon DB access, current TabBar, design tokens).
- **Audit first:** inventory existing components, tokens, TabBar, global styles. **Reuse** them; new tabs are additive in implementation even though the bar's tab *set* changes (below).
- Avoid a **second, parallel design system**. Extend existing primitives; only replace a file when genuinely superseded, and say so.

## Target & platform
- **Primary device: iPhone 15 Pro Max.** ~430×932pt @3x, Dynamic Island top, home indicator bottom.
- **PWA now, IPA later** (e.g. Capacitor). Use `env(safe-area-inset-*)`, target `display: standalone`, no browser-chrome reliance, touch targets ≥ 44pt.
- Stack: Next.js (App Router), Tailwind v4, Geist, Neon Postgres, Anthropic SDK, deployed on Vercel (use **Vercel Cron** for scheduled jobs).

## Core architecture principle — keep token cost flat (CRITICAL)
- **All** trends/averages/comparisons computed in **SQL/JS — never the LLM.** Charts render from computed numbers; AI is not in the chart path (token cost 0, any data volume).
- AI writes only **observations**, from a **fixed-size summary** (pre-aggregated stats + latest reflections), never raw rows.
- The **Articles feature uses ZERO AI tokens** — image/description/body all come from the feed or email; no LLM processing.
- Util: `computeTrends(metric, range)` → `{ points[], average, prevAverage, delta, direction, daysAbove, daysBelow }`.

## Navigation / bottom TabBar — REPLACES the current tab set
The new bottom bar **replaces the app's current tabs entirely** (agent has context on the current tabs). Final set (5 tabs — iOS max; if more are ever needed use a "More" overflow):
1. **Summary** (existing morning briefing) — keep.
2. **Trends**
3. **Observations**
4. **Inputs**
5. **Articles**
Curved, safe-area aware.

## Database (Neon Postgres) — hybrid schema
Typed columns for aggregates; `jsonb` for raw payloads + flexible content.
- `health_days(user_id, date, readiness, sleep_score, sleep_hours, hrv, resting_hr, activity_score, steps, active_cal, raw jsonb)`
- `logs(id, user_id, ts, type, amount numeric, unit)` — `type` in `{'caffeine','alcohol'}`; caffeine mg, alcohol drinks.
- `reflections(id, user_id, date, body text)`
- `observations(id, user_id, range_start, range_end, body text, model, created_at)`
- `sources(id, user_id, name, kind, identifier, active bool, created_at)` — `kind` in `{'rss','email'}`; `identifier` = feed URL or inbound email key.
- `articles(id, source_id, guid unique, title, image_url, description, body_html text, published_at, original_url, fetched_at)` — `body_html` is the **sanitized full content** for in-app reading.
- Indexes: `(user_id, date)`, `(user_id, ts)`, `articles(source_id, published_at desc)`, unique on `articles.guid`.

## Tab specs

### Articles tab — refs: IMG_0873 (list), IMG_0874 (reader), IMG_0875 (body)
- **List view:** cards showing the article **image + title + brief description** (all taken directly from the feed/email — no AI). Card style per IMG_0873 (image banner with rounded top, text on dark lower half).
- **In-app reader (REQUIRED):** tapping a card opens the **full story inside the app** — hero image, big title, body paragraphs (per IMG_0874/0875). **It must never navigate out to Safari/an external browser.** Render `articles.body_html` (sanitized). If the user taps a link *inside* an article, open it in an **in-app sheet/browser**, not the system browser.
- **Cap:** display the latest **5** articles (`ORDER BY published_at DESC LIMIT 5`). Older articles may stay in the DB as an archive but aren't shown.
- **Cap:** display the latest **5** articles (`ORDER BY published_at DESC LIMIT 5`). Older articles may stay in the DB as an archive but aren't shown.
- **Refresh:** **daily** via Vercel Cron + **pull-to-refresh**. The dedicated mailbox is polled on that schedule; because newsletters arrive at most ~once/day per source, scheduled polling is effectively real-time. Dedupe by `Message-ID` (→ `guid`); insert new, skip existing.
- **Sources / ingestion — EMAIL is the primary (and currently only) source type:**
  - **Use a dedicated newsletter mailbox** — a new free email account used ONLY for newsletters. Do NOT point ingestion at the user's personal inbox (privacy + clean parsing).
  - Fill it two ways: subscribe newsletters directly to it, OR set an auto-forward filter in the user's main inbox for newsletter senders (lets them keep receiving in their normal inbox too).
  - **Ingest by polling** that mailbox on the Vercel Cron (and pull-to-refresh; may poll a few times/day). A webhook/inbound-email push service is **optional, not needed** at newsletter cadence.
  - **Access:** IMAP (Gmail **app password** + 2FA) or Gmail API (**OAuth**). Store credentials/token in **server-side secrets** — never in the client or repo.
  - **Parse each message:** subject → `title`; first sizable non-tracking inline image → `image_url`; preheader / first paragraph → `description`; **sanitized HTML body → `body_html`**; best-effort strip of footer / unsubscribe / ad chrome (per-sender and imperfect — a sanitized full body is the baseline).
  - **Sanitize all stored HTML** (e.g. sanitize-html / rehype-sanitize) before rendering; strip scripts/tracking pixels/unsafe tags.
  - *(Optional later — if a Substack/blog is added: `kind='rss'`, poll the feed, store `content:encoded` if present else summary + optional readable-content extraction from `original_url`.)*
- **Source setup help (deliverable + interactive):** build a **Sources management screen** (add/remove/toggle sources), AND during implementation **walk the user through email setup** — create the dedicated mailbox, choose subscribe-vs-forward, add the IMAP/OAuth credentials to secrets, and verify articles flow in.
- Components: `<ArticleList>`, `<ArticleCard>`, `<ArticleReader>`, `<SourcesManager>`, plus the mailbox-polling ingestion job.

### Trends tab — refs: IMG_0866, IMG_0869 (highlight + year comparison), IMG_0868 (detail + selector, CIRCLED)
- **Highlight card** per metric: is the **past 7 days** above/below the user's baseline average? Mini bar chart + average line; comparison stated in words; show `daysAbove`/`daysBelow` of 7.
- Tap → detail view (IMG_0868) with **D / W / M** segmented selector. **M = trailing 30 days, NOT calendar month.** (6M/Y later.)
- Detail: segmented control, "AVERAGE" + big value + date-range subtitle, full bar chart with gridlines + day labels, Trend pill. **All from `computeTrends` — no AI.**
- Components: `<MetricHighlightCard>`, `<MetricDetailView>`, `<TimeRangeToggle>`, `<TrendChart>`.

### Observations tab
- Rounded cards interweaving **user reflections** (their thoughts) and **AI interpretation** (reads Oura + past data + reflections → what's happening, **what to change, why, for what outcome**).
- AI observation from the **fixed-size summary**, stored in `observations`; show latest + history. "Generate observation" calls the AI endpoint with the compact summary.
- Components: `<ReflectionComposer>`, `<ObservationCard>`.

### Inputs tab
- Curved buttons/cards.
- **Caffeine:** a **scrollable slider** in **25 mg steps** (0, 25, 50 …). Confirm → write `caffeine` row.
- **Alcohol:** simple counter — log number of drinks → write `alcohol` row.
- Logs timestamped (device/user time).
- Components: `<CaffeineSlider step={25}>`, `<AlcoholCounter>`, `<LogButton>`.

## Observed design tokens (translate to Briefing tokens; don't hardcode Apple colors)
- Cards: dark elevated surface, ~20px radius, ~16–20px padding, consistent gaps. Section titles bold white ~28–32px. Metric label row: small icon + label + optional timestamp/chevron. Insight headline semibold ~20–22px.
- Mini bar chart: thin gray bars + colored horizontal average line; left column label + big number + unit; single-letter day labels.
- Year comparison: big number + unit, full-width horizontal bar — current year accent-filled with label inside; prior year shorter muted-gray bar (width ∝ value).
- Segmented control: dark pill track; selected = lighter rounded pill with subtle elevation; white text, inactive dimmer.
- Trend pill: hairline-bordered `rounded-full`, label left + value right.
- Stat tiles: icon+label top-left, timestamp+chevron top-right, big value bottom-left, ring/sparkline bottom-right.
- Article card: image banner (rounded top) + title/subtitle on dark lower half. Reader: hero image + big bold title + body in slightly-dimmed white.
- TabBar: floating, icon+label per tab, selected in accent.

## Corrected image → screen map
- `IMG_0866` — Active Energy **Highlights** (highlight card + year + month comparison).
- `IMG_0867` — Main **Summary** screen (metric card + Walking+Running + "Show All Highlights").
- `IMG_0868` — **Metric detail view** with **D/W/M/6M/Y selector (circled)** + weekly bar chart + Trend pill. ← core interaction.
- `IMG_0869` — Active Energy **Highlights** (same family as 0866).
- `IMG_0871` — **Stat tiles** (Activity ring + Steps sparkline).
- `IMG_0872` — **Action cards** (questionnaire/health details) — styling ref.
- `IMG_0873` — **Articles list** — Articles tab list view (REAL feature).
- `IMG_0874` — **Article reader** — in-app reader (REAL feature).
- `IMG_0875` — **Article body** w/ segmented pills — in-app reader body (REAL feature).

## Suggested phasing (agent: produce your own detailed version, then ONE phase per turn)
1. Codebase audit + DB schema/migrations + `computeTrends()` util (mock data/tests).
2. New bottom TabBar (5 tabs, replacing current set) + routing skeleton, iPhone 15 Pro Max safe-area, reusing existing tokens.
3. Inputs tab (caffeine slider + alcohol counter + logging).
4. Trends tab (highlight cards + detail view with D/W/M selector).
5. Articles tab: `sources`/`articles` schema in use, dedicated-mailbox email ingestion (IMAP app-password or Gmail API OAuth) polled on Vercel Cron, Sources manager, in-app reader (sanitized, no external nav), 5-article cap. Help user create the mailbox + subscribe/forward.
6. Observations tab (reflection composer + AI observation endpoint + cards).
7. Polish: icons, transitions, PWA manifest + standalone + safe-area, prep for IPA wrap.

## Deliverables
- **First turn:** the detailed phased plan only.
- **Each later turn:** exactly one phase, as complete, copy-pasteable, typed files. Stub anything not wired (Oura, source credentials) with `// TODO`. Stop for review after each phase.
