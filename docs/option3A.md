You are starting a fresh Claude Code session for the Briefing app redesign.

Important context:
The full approved redesign plan is saved at:

/Users/noahmartz/.claude/plans/query-what-are-the-rosy-pizza.md

Phases 0–4 have already been implemented. I no longer want to continue one phase at a time. I want you to complete the rest of the redesign in one coordinated pass, while also revisiting the Phase 0–4 work where necessary to make the final design direction consistent.

Use high effort.

Do not ask more questions unless there is a true blocking ambiguity.
Do not re-plan from scratch.
Do not abandon the approved roadmap.
Do not rewrite unrelated systems.
Do not change database schema.
Do not change API behavior unless absolutely necessary to preserve existing UI functionality.
Do not change Oura sync, auth, briefing generation, AI generation, or achievement logic.

Your job:
Complete the remaining redesign work in one full pass:

* Finish Reflect / Log merge
* Finish Progress / Achievements redesign
* Finish final polish, empty states, error states, skeletons, motion, charts, and accessibility
* Revisit already-completed Phases 0–4 only where necessary to make the selected visual direction consistent across the whole app

Selected final visual direction:
Use Option 3A as the final design direction.

Option 3A means:

* sleek and minimal
* dark-first
* data-rich but breathable
* subtle teal glow
* clean typography
* restrained glass
* strong numeric hierarchy
* premium Apple Health-like structure
* high-tech through precision, hierarchy, polish, and data clarity
* not cyberpunk
* not neon-heavy
* not rainbow
* not flashy
* not childish
* not generic SaaS

The app should feel like:

Apple Health + premium iOS system app + AI-native personal health intelligence product.

It should feel:

* intelligent
* calm
* precise
* personal
* elevated
* modern
* clinically trustworthy
* visually expensive
* emotionally cool without feeling cold

It should look “sick” because it is extremely polished, cohesive, technically confident, and beautifully structured — not because it uses loud effects.

Core design principles:

1. Clarity first
   Every screen should have a clear purpose, strong hierarchy, and obvious primary action or takeaway.

2. Health insights over raw widgets
   The app should emphasize meaningful trends, interpretation, and progression over time, not just dump numbers.

3. Data-rich but breathable
   Dense screens can contain many metrics, but they must remain scannable, touch-friendly, and organized.

4. One focal surface per screen
   Each major screen can have one hero/focal panel or primary interaction. Avoid multiple competing hero panels.

5. Meaningful depth
   Glass, translucency, shadows, glow, blur, and layering should create hierarchy and premium feel. Do not create visual fog.

6. Restrained high-tech feel
   Use subtle teal glow, precise chart work, crisp cards, tactile motion, and clean icons. Do not use cyberpunk neon or decorative sci-fi noise.

7. Reusable systems
   Any new or improved visual treatment should become a reusable pattern, not a one-off.

Preflight:
Before editing, run:

git status
git branch --show-current
git remote -v

If there are uncommitted app-code changes, inspect them first. If they are expected in-progress redesign changes, continue carefully. If they look unrelated or risky, stop and report.

Also read:

/Users/noahmartz/.claude/plans/query-what-are-the-rosy-pizza.md

Then inspect the current implementation before editing.

Main scope:

A. Reflect / Log completion

Make /reflect the main route for manual input and journaling.

Reflect should include:

* Quick-Add / today status tiles
* caffeine input
* alcohol input
* workout input
* mood input
* reflection composer
* history

If /log still exists, preserve compatibility by redirecting /log to /reflect or keeping /log as a safe wrapper.

Final IA:

* Insights = read, ask, analyze
* Reflect = write, log, journal

Preserve all existing behavior:

* do not change input slider logic
* do not change caffeine/alcohol/workout/mood storage behavior
* do not change reflection API
* do not change AI processing behavior
* do not change database schema

The Reflect screen should feel like a premium iOS input surface, not a generic form page.

Recommended Reflect structure:

1. Page title and short subtitle
2. Quick-Add / today context tiles
3. Input sections
4. Reflection composer as the main writing surface
5. History as lower-priority supporting content

Apply Option 3A styling:

* dark glass cards
* subtle teal focus states
* clean section hierarchy
* restrained glow
* touch-friendly controls
* clear composer surface
* no clutter

B. Progress / Achievements completion

Redesign Progress/Achievements for scanability while preserving existing achievement visuals and logic.

Keep:

* overall progress bar
* X of Y earned
* existing achievement catalog
* existing unlock criteria
* existing achievement logic
* medal/tier styling
* calm/desaturated metal system
* locked achievements visible
* no emoji
* no confetti
* quiet unlock style

Do not modify:

* lib/achievements.ts catalog/logic
* unlock criteria
* achievement calculations
* database schema

Add progressive disclosure:

* each category shows the first 4 achievements by default
* add “Show all (N)” or equivalent
* allow collapse again if it fits naturally
* category summaries should show earned count, total count, and progress

Locked achievements should feel discoverable, premium, and slightly muted — not hidden and not broken.

Add a polished first-run empty state if no achievements are earned.

The Progress screen should feel like a serious premium progress system, not a game menu or badge wall.

C. Final shared UI primitives

Create or finalize shared primitives where needed:

* EmptyState
* ErrorState
* Skeleton
* SectionHeader
* chart container / chart shell if useful
* progress/category header if useful
* reusable stat/input/card pattern if useful

Use existing component locations and conventions.

EmptyState should support:

* optional icon
* heading
* description
* optional primary CTA
* optional secondary CTA
* calm glass/card styling
* Option 3A tone

ErrorState should support:

* clear error heading
* plain-language description
* optional retry action
* restrained semantic danger styling
* no loud red panels unless truly necessary

Skeleton should:

* reserve final layout space
* prevent layout shift
* feel premium and calm
* respect reduced motion

Replace inconsistent empty/loading/error states across major surfaces where practical:

* Today
* Health
* Insights
* Reflect
* Progress
* Articles
* More/Settings if obviously needed

Do not over-touch unrelated surfaces. Prioritize visible inconsistencies.

D. Motion and interaction polish

Systematize motion timing.

Replace scattered magic-number animation delays where practical with a shared stagger scale or small helper.

Preserve and refine existing motion vocabulary:

* spring-in
* fade-up
* score-pop
* slide-up
* sheet-up
* drawer-in

Motion should feel:

* iOS-like
* tactile
* precise
* layered
* restrained
* premium

Motion should not feel:

* flashy
* bouncy in a childish way
* distracting
* web-template-like

Preserve prefers-reduced-motion behavior.

Any new motion must respect reduced-motion settings.

E. Chart polish

Give MetricBarChart and any line chart a subtle draw-on/reveal polish where practical.

Charts should feel:

* precise
* calm
* readable
* premium
* data-rich but not busy

Do not over-animate charts.
Do not add decorative chart effects.
Do not make charts harder to read.

F. Option 3A consistency pass across Phases 0–4

Phases 0–4 are already done, but revisit them if needed so the whole app feels coherent with Option 3A.

Review:

* Today
* Health
* Insights
* Reflect
* Progress
* More
* Articles
* shared nav
* shared cards
* charts
* empty states
* loading states

Look for places where the app still feels:

* junior
* inconsistent
* too plain
* too crowded
* too visually different from the new direction
* too much like old pre-redesign UI
* too generic SaaS
* too flashy or noisy

Make small, safe polish improvements only.

Do not redo Phases 0–4 from scratch.
Do not start a totally new visual language.
Do not rewrite working route architecture.
Do not rebuild the app.

G. Accessibility and contrast pass

Check dark and light mode.

Focus on:

* text contrast
* muted labels
* chart lines and axes
* buttons and active states
* focus states
* tap targets
* semantic color use
* avoiding color-only meaning where possible
* reduced-motion support
* obvious screen-reader labels

Do not claim automated AA success unless actually checked.

If the pass is manual, say it was a manual visual/accessibility pass.

Strict do-not-touch list:

Do not modify these unless absolutely required for a small UI integration fix, and explain it if you do:

* app/api/**
* lib/db.ts
* lib/auth.ts
* lib/crypto.ts
* proxy.ts
* lib/jobs.ts
* lib/pipeline/**
* extra-schema.sql
* service worker / PWA config
* Anthropic or AI generation logic
* database schema
* migrations
* achievement catalog logic
* Oura sync behavior
* briefing generation behavior

Execution rules:

* Work in small, reviewable edits.
* Preserve all existing functionality.
* Do not invent fake data.
* Do not add new product features outside the redesign.
* Prefer reusable primitives over one-off UI.
* Keep the dark-first Circadian Glass / SF Pro Rounded / teal-accent direction.
* Apply Option 3A consistently.
* Make the app feel more coherent, more expensive, more Apple-like, and more technically confident.
* Do not make the UI louder.
* Do not produce a giant rewrite if targeted cleanup achieves the goal.

Verification:
After edits, run:

npx tsc --noEmit

Then run:

npm test

Then run:

npm run build

If npm test is not configured or fails for reasons unrelated to your changes, report that clearly.

If npm run build fails only because of the known local Neon/DATABASE_URL prerender issue, report that clearly as an environment issue.

If any command fails because of your changes, fix it and rerun.

Final report:
At the end, report:

1. Files changed
2. New shared primitives created or finalized
3. Reflect / Log changes
4. What happened to /log
5. Progress / Achievements changes
6. How progressive disclosure works
7. Empty states replaced or added
8. Error states added
9. Skeleton/loading improvements
10. Motion/stagger improvements
11. Chart polish added
12. Accessibility/contrast findings
13. Option 3A consistency improvements across Phases 0–4
14. Reusable patterns/components strengthened
15. Confirmation that no database schema, AI generation, Oura sync, or achievement logic was changed
16. Verification result for npx tsc --noEmit
17. Verification result for npm test
18. Verification result for npm run build
19. Remaining risks or recommended follow-up cleanup

Begin by reading the saved redesign plan and inspecting the current implementation. Then complete the remaining redesign work in one coordinated pass.
