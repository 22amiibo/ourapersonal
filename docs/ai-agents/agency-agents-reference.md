# agency-agents — optional reference (not installed)

Source: https://github.com/msitarzewski/agency-agents — 232 agent personas across 16 divisions
(engineering, product, design, testing, security, marketing, etc). Ships an installer that copies
`.md` persona files into `~/.claude/agents/`.

## Why optional, not adopted

This repo already has graphify (orientation) + superpowers (process) + ecc (specialist review/
build/security agents) covering daily work — see `CLAUDE.md` § Tool & skill decision guide. Adding
a 232-agent library as a default would violate this project's low-token, few-agents rule. Nothing
here should be installed, scripted, or auto-invoked; it's an idea source for Claude (or the user) to
skim when planning a big redesign, not active tooling.

## Concepts worth borrowing (when planning big work only)

- `product/product-manager.md`, `product/product-sprint-prioritizer.md` — scope-control framing
  (what's MVP vs cut) for redesign phasing. No ecc/superpowers equivalent — those tools review or
  build code, not scope product work.
- `design/design-ux-architect.md`, `design/design-persona-walkthrough.md` — critique a proposed
  flow by walking it as a named user persona. Useful for validating nav/IA changes against the
  Apple-Health-inspired direction before building. No direct ecc/superpowers equivalent.

Use these as **prompts to read and adapt inline** (open the `.md`, borrow the framing in a
brainstorming or planning message) — not as installed agents.

## Concepts that overlap existing tools — do not duplicate

- `testing/testing-accessibility-auditor.md` → already covered by `ecc:a11y-architect` and the
  `ecc:accessibility` / `ecc:frontend-a11y` skills.
- `testing/testing-performance-benchmarker.md` → already covered by `ecc:performance-optimizer`
  and `ecc:react-performance`.
- `testing/testing-evidence-collector.md`, `testing/testing-reality-checker.md` → already covered
  by the `verify` skill (drive the real flow, observe behavior) and
  `superpowers:verification-before-completion` (tsc/test/build green bar).
- `security/*` → already covered by `ecc:security-reviewer` and related ecc security skills.

Routing any of the above to agency-agents personas would be a second, competing implementation of
something this repo already has a working answer for.

## App-specific cautions

- **Single-user PWA, no team.** Divisions like marketing, sales, finance, project-management don't
  apply — this isn't a studio with stakeholders to manage.
- **Health data privacy.** Any borrowed persona touching user data, logs, or observations must still
  follow this repo's rules: SQL only via `lib/db.ts`, no secrets committed, `OuraVault/` is
  hands-off user data.
- **Token cost is flat, by design.** Don't introduce personas that make repeated or unbounded LLM
  calls (this repo's AI calls are one-shot, bounded — see `lib/anthropic.ts`, `lib/prompts.ts`).
- **Design direction.** If borrowing `design-ux-architect`/`persona-walkthrough` framing, check
  against `docs/EXPO_DESIGN_GUIDE.md` (Apple-Health-inspired, teal `#14b8a6`, SF Pro Rounded), not
  agency-agents' generic UI conventions.
