# CLAUDE.md — "Briefing" (Oura personal-health PWA)

## What this project is
A single-user personal-health PWA ("Briefing") that pulls Oura ring data, manual logs, a
calendar feed, and newsletter emails into an Apple-Health-style dashboard, then writes small
AI observations on top. Stack: **Next.js 16 App Router · React 19 · Tailwind v4 (`@theme`
tokens in `app/globals.css`) · Neon Postgres · Anthropic SDK · Vercel (+ cron)**. Design
contract: `docs/EXPO_DESIGN_GUIDE.md`; live tokens (teal accent `#14b8a6`, SF Pro Rounded)
in `app/globals.css`.
Architecture rule that explains most code: **token cost is flat** — all trends, averages,
achievements, and articles are pure SQL/JS; the AI only ever sees a fixed-size summary.

> Naming note: this is NOT the Graphify codebase. `graphify` is a knowledge-graph *tool*
> installed on top of this repo (skill at `.claude/skills/graphify/`, output in `graphify-out/`).

## Read next (in this order, every session)
1. `.claude/handoff.md` — project status, working rules, **deploy process + gotchas**.
2. `docs/round3-questions.md` — newest shipped work (Awards tab, motion, semantic colors)
   and open product questions. Newer than handoff.md where they disagree.

Only when the task needs them: `.claude/briefing-build-spec.md` + `.claude/implementation-plan.md`
(5-tab rebuild spec/plan, historical), `docs/EXPO_DESIGN_GUIDE.md` (UI feel contract),
`extra-schema.sql` (all non-core tables).

## ⚠️ Environment gotchas (this machine — verify before any git operation)
- **This folder has NO `.git`.** Git commands resolve to a repo rooted at `/Users/noahmartz`
  (remote `22amiibo/anotherone`). Committing/pushing from here does NOT version or deploy this
  project — it dumps files into an unrelated home-directory repo. The canonical project repo is
  `22amiibo/ourapersonal` (see handoff.md). **Ask the user before any commit/push.**
- Deploys (from a proper clone): git author email must be `2wohundredamiibo2@gmail.com`, and push
  BOTH branches: `git push origin master && git push origin master:main`.
- Untracked `.ts`/`.tsx` files silently break Vercel builds (local passes, CI module-not-found).
- Hooks in `.claude/settings.json` enforce graphify-before-read/grep. `OuraVault/` is the exported
  Obsidian vault (user data — never edit or ingest; it's in `.graphifyignore`).

## Directory map
```
app/                  Next.js App Router — pages + API (see app/README.md)
  api/                All server endpoints (see app/api/README.md)
  components/         All UI components by domain (see app/components/README.md)
  globals.css         Tailwind v4 @theme tokens — THE design-token source of truth
lib/                  Server/shared logic — db, jobs, AI, pipeline (see lib/README.md)
proxy.ts              Auth gate (Next 16's middleware) — session cookie check + route matcher
extra-schema.sql      Full SQL schema for added tables (run sections manually in Neon)
scripts/              apply-extra-schema.mjs — helper to apply schema
docs/                 Design guide, round-3 status/questions, superpowers plans/specs archive
public/               PWA assets, service worker, icons
.claude/              handoff.md (status), spec/plan, hooks, graphify skill, settings
graphify-out/         Generated knowledge graph (graph.json, GRAPH_REPORT.md) — never hand-edit
OuraVault/            Exported Obsidian vault — user data, hands off
```

## Task → location
| Task involves… | Look in |
|---|---|
| Dashboard/Summary UI | `app/page.tsx`, `app/dashboard/`, `app/components/cards/` |
| Trends charts/ranges | `app/trends/`, `app/components/trends/`, `lib/trends.ts` (+ its tests) |
| Logging inputs (caffeine, alcohol, mood, weight) | `app/log/LogTab.tsx`, `app/components/inputs/`, `app/api/log/*` |
| Articles / newsletter ingest | `lib/articles/`, `app/api/articles/`, `app/components/articles/` |
| Observations / AI coach / insights | `app/api/observations/`, `app/insights/`, `lib/prompts.ts`, `lib/anthropic.ts` |
| Achievements ("Awards" tab) | `app/achievements/`, `lib/achievements.ts` (+ tests) |
| Oura sync / webhook | `lib/oura.ts`, `app/api/oura/*` |
| Auth (password + WebAuthn) | `lib/auth.ts`, `lib/crypto.ts`, `app/api/auth/*`, `proxy.ts`, `app/login/` |
| Daily cron / briefing job | `app/api/cron/daily/`, `lib/jobs.ts`, `lib/pipeline/` |
| Push notifications | `lib/push.ts`, `lib/notify-timing.ts`, `app/api/push/*`, `app/api/cron/nudge/` |
| Schema / new table | `extra-schema.sql` (+ tell the user to run it in Neon — see handoff) |
| Design tokens / theming | `app/globals.css` (`@theme`), `docs/EXPO_DESIGN_GUIDE.md` |
| Nav / tabs | `app/components/TabBar.tsx`, `NavShell.tsx`, `CommandPalette.tsx` (route lists NOT unified — see round3 Q8) |

## Tool & skill decision guide
**Default = plain Read/Edit.** Most tasks here touch 1–4 files. Do not invoke a skill or agent
for copy changes, styling tweaks, small bug fixes, or adding a field to an existing endpoint.

**graphify — orientation, before exploration (hooks enforce this).**
For any "where is / how does / what touches" question, run `graphify query "<question>"`
(also `graphify path "<A>" "<B>"`, `graphify explain "<concept>"`) before reading or grepping
source. After modifying code, run `graphify update .` (AST-only, no API cost). Cheap: returns a
scoped subgraph instead of raw file dumps.

**superpowers — process discipline for big or risky work.** A methodology plugin; its skills
change *how* you work, not what you know. Reach for it when:
- Building a real feature (multi-file, needs design): `superpowers:brainstorming` → `writing-plans`
  → `executing-plans`. Brainstorming interrogates the user first — that's the point; don't use it
  for tasks that are already fully specified.
- A bug resists the first obvious fix: `superpowers:systematic-debugging` (evidence before fixes).
- About to say "done": `superpowers:verification-before-completion` (run `npx tsc --noEmit`,
  `npm test`, `npm run build` — the project's green bar).
Cost: extra process steps and user back-and-forth; worth it above ~3 files or any schema change.
NOTE: `superpowers:subagent-driven-development` conflicts with handoff.md's "no subagents" rule —
prefer `executing-plans` inline.

**ecc — a specialist when you need one, not a workflow.** A large library of domain agents/skills.
The useful subset for this repo:
- After a nontrivial code change: `ecc:typescript-reviewer` / `ecc:react-reviewer` agents (or
  `/ecc:code-review`) for review.
- Build or type errors you can't fix in one pass: `ecc:react-build` / `ecc:build-fix`
  (build-resolver agents make minimal diffs to get green).
- Touching auth, cookies, API input, or secrets: `ecc:security-reviewer`.
- SQL/schema design: `ecc:database-reviewer`.
Cost: **each ecc agent is a separate context — real token spend**; ecc hooks (e.g. the GateGuard
fact gate on first Bash) add friction. Don't launch one for changes a direct read of the diff can
review. handoff.md's older "no subagents" rule predates ecc's install; treat review/build-resolver
agents as the sanctioned exception, keep everything else inline. (2026-07-02)

**Ordering that matters:** graphify query → (superpowers process, if big) → edit → `graphify
update .` → verification (superpowers verification or ecc reviewer) → user handles git/deploy.

**Retired (deleted 2026-07-02):** the old "Ruflo / Karpathy Mode / Open Design" frameworks
(`.claude/framework-reference.md`, `workflow-router.md`, `skill-router.md`, `project-context.md`)
were hand-written prompt personas, not installed skills. If any doc still mentions them, this
section supersedes it.

## Entry points & conventions
- Pages: `app/*/page.tsx`; shared chrome in `app/layout.tsx` + `app/template.tsx` + `NavShell`.
- Single user: `USER_ID = 1` and `userTz()` from `lib/jobs.ts`. No multi-tenancy anywhere.
- SQL **only** via `import { sql } from "@/lib/db"` (Neon tagged templates). No ORM.
- AI calls **only** via `lib/anthropic.ts` + tool definitions in `lib/prompts.ts`; bounded, one-shot.
- Reuse `app/components/ui/*` primitives; never build parallel design primitives.
- Keep files < 500 lines. Validate input at API boundaries. Never commit secrets (`.env` / Vercel).
- Tests: `npm test` (node:test via tsx) — colocated `lib/*.test.ts`. Verify with
  `npx tsc --noEmit` + `npm test` + `npm run build` before claiming done.
- Next.js 16 has breaking changes vs training data — check `node_modules/next/dist/docs/` when unsure.

## Common tasks quick-reference
| Task | Files | Tool/skill |
|---|---|---|
| Tweak a card/chart | `app/components/{cards,trends,ui}/…` | none — direct edit |
| New metric on Trends | `lib/trends.ts` + test, `app/components/trends/metricMeta.ts`, `/api/trends` | superpowers:test-driven-development |
| New API endpoint | `app/api/<name>/route.ts`, `lib/db.ts` patterns, maybe `extra-schema.sql` | direct; ecc:security-reviewer if auth-adjacent |
| Change AI behavior | `lib/prompts.ts`, `lib/jobs.ts`, `app/api/observations/` | direct — keep calls bounded/one-shot |
| Build broken | error output first | ecc:react-build / ecc:build-fix |
| "How does X work?" | — | graphify query, then targeted reads |
| Big new feature | spec in `docs/` or `.claude/` first | superpowers brainstorming → plans |
