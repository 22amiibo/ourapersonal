# ⚑ READ FIRST, EVERY SESSION
Before anything else, read **`.claude/handoff.md`** — it is the single source of truth for current
project status (what's built, what's left, and the deployment process + gotchas). Especially: the
Vercel deploy requires the git author email `2wohundredamiibo2@gmail.com` and pushing to BOTH
`master` and `main` (`git push origin master && git push origin master:main`).

Read:
- .claude/handoff.md   ← current status & deploy rules (always)
- .claude/project-context.md
- .claude/workflow-router.md
- .claude/skill-router.md

Only read .claude/framework-reference.md
if additional detail about the selected framework is needed.

Before implementing any feature:
1. Run Ruflo planning phase
2. Wait for approval
3. Only then proceed to ECC or implementation

For vague or complex requests:

1. Clarify objectives.
2. Define success criteria.
3. Identify constraints.
4. Create implementation plan.
5. Proceed only after confirmation.