# Design Guide — Briefing ("Circadian Glass")

> **Purpose:** the durable design contract for this app. Read this fully before
> touching UI. It documents the **actually-shipped** design system and the
> discipline rules that keep it feeling senior.
>
> Source of truth for token *values*: `app/globals.css` (`@theme` + `:root`).
> Source of truth for visual *intent*: this file.
>
> **History note:** this file previously described an aspirational "Expo.dev"
> restyle (Inter typeface, blue accent, monochrome repaint). That direction was
> never shipped and is superseded. The shipped, locked system is:
> **SF Pro Rounded · teal accent `#14b8a6` · Circadian Glass · dark-first.**
> The filename is kept only so existing references resolve. If a doc or plan
> mentions Inter or a blue accent as "the design," it is stale — this file wins.

---

## 1. The system in one paragraph

A dark-first, Apple-Health-inspired personal intelligence app. Depth comes from
two tiers of translucent glass over an ambient circadian background — never from
heavy shadows. SF Pro Rounded gives it warmth; Geist Mono (`tabular-nums`) gives
every number precision. Teal is the single accent and it is rationed. Amber,
rose, and blue exist only as *meaning* (warning / danger / sleep-identity),
never decoration. Motion is a whisper: things settle in once per session and
respond to touch; nothing bounces for attention.

## 2. What it must never feel like

- A generic SaaS dashboard (tables, sidebars, data-dense grids).
- A random pile of cards — every screen groups content into named sections.
- Colorful. Teal ≤2 appearances per screen; everything else neutral or semantic.
- Gamified-childish. The Achievements tab (desaturated metal tiers, no confetti,
  quiet toast) is the reference bar for restraint — match it, don't exceed it.
- "AI-generated UI slop": gradient soup, glow-everywhere, oversized radii,
  arbitrary one-off sizes. The circadian canvas is the **one** sanctioned
  gradient in the app.

---

## 3. Color

All values live in `app/globals.css`; use tokens, never raw hex, in components.

| Role | Token | Rule |
|---|---|---|
| Canvas | `--color-bg` | Pure black dark / cool white light. |
| Surfaces | `--color-surface`, `-2`, `-3` | Ascending elevation tones. |
| Text | `--color-ink`, `-2`, `-3` | Primary / secondary / tertiary. Never `text-white` in new code — use `text-ink`. |
| **Accent** | `--color-accent` (teal `#14b8a6`) | **≤2 appearances per screen.** Tab-bar active state counts as one; a focal CTA counts as one. Links, focus rings, and selected chips share the same budget. |
| Accent (dim) | `--color-accent-dim` | Pressed/secondary accent states. |
| Semantic | `--color-success / -warning / -danger / -neutral` | Meaning-named; AA-tuned light values exist. Prefer these over raw `--color-amber`/`--color-rose` so meaning never drifts. |
| Category identity | blue = Sleep, amber = Activity, teal = Recovery | Only on the Health/Trends category surfaces; monochrome everywhere else. |
| Achievement tiers | `--tier-1`…`--tier-5` | Bronze → diamond, deliberately desaturated. Do not brighten. |

Semantic color is **earned by state** (a caffeine total going over its limit may
turn amber), never applied as decoration (a coffee icon is `text-ink-2`, not
amber).

## 4. Typography

**SF Pro Rounded** (`--font-sans`) is the only sans. **Geist Mono**
(`--font-mono`, always `tabular-nums`) is for numbers, IDs, timestamps. Never
add a third family.

The type scale is tokenized — use it. **No new `text-[Npx]` arbitrary sizes.**

| Role | Token | Weight | Tracking |
|---|---|---|---|
| Display (hero numbers, page hero) | `--text-display` (clamp 30–38px), utility `.text-display` | 700 | `-0.03em` |
| Screen title | `--text-title-l` (22px) | 600 | `-0.02em` |
| Card/section title | `--text-title-m` (18px), utility `.text-title-m` | 600 | `-0.01em` |
| Body | `--text-body-l/-m/-s` (15/14/13px) | 400–500 | 0 |
| Label/eyebrow | `--text-label` (11px) | 500 | `+0.08em`, UPPERCASE |
| Micro | `--text-micro` (10px) | 500 | `+0.06em` |

Rules that make it look expensive:
- Big text gets **negative** tracking; UPPERCASE labels get **positive**
  tracking. Never the reverse.
- Three working weights: 400 read · 500/600 emphasize · 700 announce.
- Reference scale tokens without a utility as
  `text-[length:var(--text-body-l)]` — still tokenized, still legal.

## 5. Surfaces & glass — one vocabulary

There are exactly **two** glass classes (the legacy third `.glass` class and its
tokens — `--surface-glass`, `--glass-border`, `--card-radius: 28px`, etc. — were
removed in the Phase-0 cleanup; do not reintroduce them):

| Class | Use |
|---|---|
| `.glass-1` | The standard card surface. Pair with `rounded-card`. |
| `.glass-2` | Elevated: the **one** hero panel per screen (Daily Briefing, Ask-your-data composer) and bottom sheets. **Max one per screen.** |

- Depth = surface-tone contrast + hairline (0.5px) border, not shadow weight.
  If something looks flat, raise its surface tone before reaching for a shadow.
- `shadow-glow*` is reserved for rare live/active states (a live ring, an
  earned award) — never on buttons, never ambient.
- `ui/GlassCard.tsx` is the shared card wrapper (glass-1 + rounded-card + press
  state). Prefer it over hand-rolling card chrome.
- Borders never heavier than 1px anywhere.

## 6. Radius

| Token | Value | Use |
|---|---|---|
| `--radius-pill` | 9999px | Every interactive control: buttons, chips, tabs, badges. |
| `--radius-control` | 12px | Inputs, small stat tiles. |
| `--radius-card` | 20px | All content cards. |
| `--radius-sheet` | 28px | Bottom sheets only. |

No `rounded-[Npx]` arbitrary values in touched code. An off-scale radius needs a
one-line comment explaining why, or it's a bug.

## 7. Buttons

Three tiers, all pill-shaped, all `min-h-[44px]`, all `active:scale-95`:

1. **Accent** — `rounded-pill bg-accent text-bg font-semibold`. The single focal
   action of a screen. Counts against the teal budget.
2. **Secondary** — `rounded-pill border border-line-strong bg-surface-2 text-ink font-medium`.
3. **Tertiary/text** — plain `text-ink-2`, no chrome.

Chips/segmented controls: resting `border-line bg-surface-2 text-ink`; selected
`border-accent` + subtle tint (`color-mix` ~15% accent) — a tint, not a glow.
**No shadows on any button at rest.**

## 8. Layout & spacing — gallery pacing

- Mobile-first, `max-w-md`, `env(safe-area-inset-*)` respected; primary target
  device is iPhone 15 Pro Max.
- Card internal padding 16–24px (`p-4`/`p-5`).
- Section gaps `space-y-5`/`space-y-6` — generous, confident air between groups.
- Screens read as **named sections**, not stacked one-off cards.
- Hit targets ≥44px.

## 9. Charts & data

- Hand-rolled SVG only — no charting library.
- Rings are reserved for the 3 headline daily scores.
- Hairline gridlines; non-active series muted (`rgba(255,255,255,.20)`-class
  values via tokens); accent color only on the active/selected series.
- Every number in Geist Mono `tabular-nums`.
- Any correlation/pattern claim carries the evidence chip pattern
  ("{n} evidence · {pct}% conf") and a thin-data caveat when applicable
  ("Limited data — keep logging for sharper answers.").

## 10. Motion — whisper, not flashy

- Vocabulary (all in `globals.css`): `spring-in`, `fade-up`, `score-pop`,
  `slide-up`, `sheet-up`, `drawer-in`, `page-enter`, ring draw-on, count-up.
- Entrances fire **once per browser-tab session** (RevealGate +
  `data-revealed`) — never on every tab switch.
- Press feedback: `active:scale-95` / `active:scale-[0.97]` everywhere
  touchable.
- `prefers-reduced-motion` is neutralized globally in CSS — every new animation
  must remain inside that guard.
- Nothing loops, bounces, or glows for attention. The achievement unlock toast
  (slide-up, ~3.2s hold, max 3 queued, no confetti) is the ceiling for
  celebration.

## 11. States

- **Loading:** use the shared `.skeleton` shimmer / `ui/Skeleton.tsx` with
  reserved heights (zero layout shift) — not spinners or label swaps.
- **Empty:** real empty states with a heading, one line of copy, and up to two
  CTAs (the Insights tab's pattern is the template). Never fake/placeholder
  data.
- **Errors:** no silent failures — every failed write surfaces a visible,
  retryable error.

## 12. Accessibility

- AA contrast in **both** themes; the light theme
  (`@media (prefers-color-scheme: light)`) has AA-tuned token overrides — new
  colors must get a light-mode counterpart in the same PR.
- 44px minimum hit targets; visible focus states drawing from the accent
  budget; reduced-motion respected (see §10).

## 13. Do / Don't

**Do**
- Tokens for every color, size, radius, shadow — `app/globals.css` is the only
  place values live.
- Pills for interactive, `rounded-card` for content, `glass-1` by default.
- Negative tracking on large text, positive on UPPERCASE labels.
- One `glass-2` hero per screen, maximum.
- Reuse `app/components/ui/*` primitives before building anything new.

**Don't**
- ❌ New `text-[Npx]`, `rounded-[Npx]`, or raw hex in components.
- ❌ Multicolor decorative icons in pickers/chrome — monochrome `text-ink-2`,
  color only where it carries meaning.
- ❌ `shadow-glow*` on buttons or as ambient decoration.
- ❌ A third typeface, or reintroducing the removed `.glass`/`--card-radius`
  legacy system.
- ❌ Gradients as decoration — the circadian canvas is the only one.
- ❌ More than 2 teal moments per screen.
- ❌ Touching `app/api/**`, DB schema, auth, or PWA/service-worker wiring for a
  visual task.
