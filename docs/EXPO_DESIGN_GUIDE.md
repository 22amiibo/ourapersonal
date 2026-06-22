# Expo Design Guide — Oura App

> **Purpose:** the durable design contract for making this app *feel like Expo*
> (expo.dev — the React Native developer platform). Read this fully before
> touching UI. It distills Expo's design language and maps every principle onto
> **our real tokens and utility classes** in `app/globals.css`.
>
> Source of truth for tokens: `app/globals.css` (`@theme` + `:root`).
> Source of truth for the visual intent: this file.

---

## 0. What we adopt vs. what we keep

We are **not** throwing away the app. We keep our soul and adopt Expo's *grammar*.

**Adopt from Expo (the "general rules"):**
- **Pill-shaped geometry** everywhere interactive — buttons, chips, tabs, badges (radius `9999px`). Soft, organic, approachable.
- **One typeface, full weight range.** Inter from 400→700 as the *only* sans. Weight **is** the hierarchy — decisive jumps, no ambiguous middles.
- **Tight negative tracking on large text** (headlines + big numbers): `-0.02em` to `-0.03em`. This is the signature move.
- **Whisper-soft shadow discipline.** Depth comes from *surface contrast* (elevated surface on a darker/lighter page), not heavy drop shadows or glows.
- **Monochrome restraint.** Chrome stays neutral. The accent appears **at most twice per screen**. Color is earned by data and meaning, not decoration.
- **Gallery pacing.** Generous, confident breathing room between sections.

**Keep (do NOT delete):**
- The dark default theme + the `@media (prefers-color-scheme: light)` block.
- `CircadianBackground` and the `body::before` circadian canvas.
- The `.glass` / `.glass-1` / `.glass-2` translucent system (it's our depth mechanism — we *tune* it, we don't remove it).
- Geist Mono for numerics (`tabular-nums`).
- Mobile-first, PWA, `max-w-md`, bottom-sheet modals, `min-h-[44px]` hit targets, `env(safe-area-inset-*)`.

---

## 1. Direction toggle

This guide supports two intensities. The prompt that ships alongside this file
declares which one is active. Default = **A**.

- **A — Expo language on dark glass (default).** Keep dark + glass + circadian.
  Restyle geometry, type, shadow, spacing, and accent rationing toward Expo.
  Blue accent kept but disciplined.
- **B — Full light repaint.** Make light the primary theme using Expo's
  cool-white canvas and monochrome black CTAs; demote glass to flat white cards
  with whisper shadows. Bigger change, most literally "Expo." See §9.

---

## 2. Token mapping (Expo → our tokens)

Expo's reference palette and the equivalent we already have. Where a value should
change, the **Recommended** column says so. Edit values in `app/globals.css`.

| Expo role | Expo value | Our token | Recommended action |
|---|---|---|---|
| Page canvas (light) | Cloud Gray `#f0f0f3` | `--color-bg` (light) | Cool-white is already close (`#f2f2f7`). Optionally nudge to `#f0f0f3`. |
| Elevated surface | Pure White `#ffffff` | `--color-surface` (light) | Already `#ffffff`. Good. |
| Headline / body ink | Near Black `#1c2024` | `--color-ink` | Keep. (`#08080f` light / `#f5f5fa` dark.) |
| Secondary text | Slate Gray `#60646c` | `--color-ink-2` | Keep. |
| Tertiary / meta | Silver `#b0b4ba` | `--color-ink-3` | Keep. |
| Card border | Border Lavender `#e0e1e6` | `--color-line` | Keep (cool lavender-gray is on-brand). |
| Accent / focal | (Expo = monochrome black) | `--color-accent` `#3b82f6` | **Keep blue but ration ≤2/screen** (dir A). In dir B, primary CTA = ink, blue demoted to links/focus. |
| Mono numerics | JetBrains Mono | `--font-mono` (Geist Mono) | Keep Geist Mono. |

**Radius — add a pill token.** In `@theme` and `:root`:

```css
--radius-pill: 9999px;   /* primary actions, chips, tabs, badges */
/* existing, keep: */
--radius-control: 12px;  /* inputs, secondary tiles */
--radius-card:    20px;  /* cards (already Expo "very rounded") */
--radius-sheet:   28px;  /* bottom sheets */
```

Add the matching utility in the `@layer utilities` block:

```css
.rounded-pill { border-radius: var(--radius-pill); }
```

(`rounded-full` from Tailwind also works and is used today — either is fine.)

---

## 3. Typography rules

Inter only. Geist Mono for numbers/IDs/timestamps. **Never** add a third family.

| Role | Size | Weight | Tracking | Line-height | Notes |
|---|---|---|---|---|---|
| Display (scores, hero numbers) | `clamp(30px,8.5vw,38px)`+ | 700 | **-0.03em** | 1.04 | Use `.text-display`; push tracking. |
| Screen title (`<h1>`) | 22px | 600 | -0.02em | 1.1 | e.g. "Daily Log". |
| Card / section title | 17–18px | 600 | -0.01em | 1.25 | |
| Body | 14–15px | 400–500 | 0 | 1.4–1.5 | |
| Label / eyebrow | 11px | 500 | **+0.08em**, UPPERCASE | 1 | already used (`tracking-[0.08em]`). |
| Micro | 10px | 500 | +0.06em | 1 | de-emphasized meta. |
| Numerics | mono, `tabular-nums` | 500–600 | -0.01em | — | Geist Mono. |

Rules:
- Big text gets **negative** tracking; ALL-CAPS labels get **positive** tracking (≥`0.06em`). Never the reverse.
- Three working weights: **400** read · **500/600** emphasize · **700** announce. Avoid 300 for UI text (too thin at small sizes); the layout already loads it but reserve it for large display only.

---

## 4. Buttons — the canonical recipes

Expo has three button tiers. Mapped to our dark-glass theme (dir A):

### 4.1 Primary (max emphasis = Expo's black pill)
Expo's black-on-white CTA inverts in a dark app to **light-on-dark**, full contrast, monochrome:
```html
<button class="rounded-pill bg-ink text-bg px-5 py-3 text-[14px] font-semibold
               tracking-[-0.01em] transition-transform active:scale-95 min-h-[44px]">
  Save
</button>
```
Use **one** per screen, for the single most important action.

### 4.2 Accent (one focal action — replaces today's `bg-accent` Save)
When an action is *the* point of the screen and you want color, use blue — but only here, and never alongside a primary in 4.1:
```html
<button class="rounded-pill bg-accent text-bg px-5 py-3 text-[14px] font-semibold
               transition-transform active:scale-95 min-h-[44px]">
  Save
</button>
```

### 4.3 Secondary (bordered pill — Expo's white-on-border)
```html
<button class="rounded-pill border border-line-strong bg-surface-2 px-5 py-3
               text-[14px] font-medium text-ink transition-transform active:scale-95 min-h-[44px]">
  Cancel
</button>
```

### 4.4 Chip / segmented (already pill — keep, refine)
Quick-add chips and `FxButtonRow` are correct in spirit. Refinements:
- Radius `rounded-full`. ✔ (already)
- Resting: `border border-line bg-surface-2 text-ink`, label Inter **600**.
- Selected: `border-accent` + a *subtle* accent tint (`bg-accent/15`) — not a glow.
- Whisper press: `active:scale-95`. No drop shadow on chips.

**Shadow rule for all buttons:** none at rest; depth is the surface + border. No
`shadow-glow*` on buttons — glows are reserved (see §6).

---

## 5. Cards & surfaces

- Standard card = `glass-1` (keep). It already reads as an elevated surface with a
  hairline border — that *is* the Expo "white card on Cloud Gray" idea, translucent.
- Tune toward whisper: prefer `--shadow-glass-1` over the heavier `--shadow-glass-2`
  for ordinary cards. Reserve `glass-2` for one hero/briefing panel per screen.
- Card radius `rounded-card` (20px) is already "Expo very-rounded." Keep.
- Internal padding 16–24px. Section gap: bump key separations from `space-y-4`
  (16px) to `space-y-5`/`space-y-6` where the screen has room — gallery pacing.
- Border weight: **never heavier than 1px** (we use 0.5px on glass — good).

---

## 6. Depth & elevation (whisper discipline)

| Level | Treatment | Use |
|---|---|---|
| Flat | no shadow | page, inline text, chips at rest |
| Surface | `glass-1` translucent + hairline | standard cards, the 4 Quick-Add tiles |
| Elevated | `glass-2` | one hero panel / the bottom sheet |
| Glow | `--shadow-glow*` | **rare**, intentional focus only (e.g. live ring, active score) — never on buttons or every card |

Expo's lesson: **the lift is the contrast, not the shadow.** If a thing looks flat,
raise the surface tone before you reach for a shadow.

---

## 7. Accent rationing (the discipline that sells "Expo")

Per screen, the blue `--color-accent` may appear **at most twice**. Audit each screen:
- Tab-bar active state counts as one if that screen owns the tab.
- A focal CTA counts as one.
- Links, focus rings, selected chips all draw from the same budget.

Everything else neutral: `text-ink` / `text-ink-2` / `text-ink-3`, borders `line`.
Semantic colors (`amber` warning, `rose` over-limit) are **not** accent — they're
meaning, used only when the state is real.

---

## 8. The screenshot — Quick Add panel (`app/log/LogTab.tsx`)

This is the panel the user flagged. Apply Expo grammar precisely.

**Before (today):** quick-add pill chips with mono qty; a `grid-cols-4` of
`rounded-control glass-1` tiles whose icons are **multicolor** (amber coffee, rose
martini, **blue** lightning, ink note); 10px labels.

**After (Expo):**

1. **Eyebrow** "QUICK ADD" — keep `text-[10px] uppercase tracking-[0.08em] text-ink-3`. ✔ on-brand.
2. **Chips** — keep `rounded-full`, raise label to `text-[13px] font-semibold`,
   qty stays mono `text-[11px] text-ink-3`. Resting border `border-line`; pressed
   `active:scale-95`. Horizontal scroll preserved (`no-scrollbar`).
3. **The 4 action tiles** — the headline change:
   - **Icons go monochrome neutral.** Drop `text-amber` / `text-rose` / `text-accent`
     on the tile icons; render all four monoline at `text-ink-2` (stroke 1.75).
     This is the single biggest "now it looks like Expo" move. *(Semantic color
     still appears where it means something — e.g. the Caffeine day-total turning
     amber/rose over limits — just not as decoration on the picker buttons.)*
   - Radius: `rounded-control` → `rounded-[18px]` (softer, between control and card).
   - Surface: keep `glass-1`; **no glow**. Label `text-[11px] font-medium text-ink-2`.
   - Keep `min-h-[64px]` and `active:scale-[0.97]`.
4. **Day-total cards** (Caffeine / Alcohol) — already Expo-correct (mono tabular
   numbers, eyebrow label, semantic color only past thresholds). Leave as-is; just
   confirm radius `rounded-card`.
5. **Save button** in the bottom sheet — switch to the §4.1 ink pill (or §4.2 accent
   pill if you want the one allowed pop of blue here). Cancel → §4.3 secondary pill.
6. **Rhythm** — bump the gap between the totals row and the picker to `gap`/`space-y-5`
   for a touch more air.

Net effect: the picker reads as a calm, monochrome, pill-and-whisper control —
color now lives only in the *data* (your caffeine number going amber), exactly the
Expo move.

---

## 9. Variant B — full light repaint (only if the prompt says so)

If dir B is active:
- Flip default to light: set `viewport.themeColor` and `body` background to the
  light canvas; treat the existing `@media light` block as the primary theme.
- Page `--color-bg: #f0f0f3`, cards flat `#ffffff` + `--elev-ring` hairline +
  whisper shadow (`rgba(0,0,0,.08) 0 3px 6px`). Demote `.glass-*` to these flat cards.
- Primary CTA = **pure black pill** (`#000` bg, white text). Blue (`#0d74ce`)
  becomes link-only.
- Remove/!important-off the circadian breathing in light (already done in CSS).
- Everything else (type, geometry, spacing, rationing) is identical to dir A.

---

## 10. Do / Don't

**Do**
- Pills for every interactive control; `rounded-card` (20) for cards.
- Inter weight as hierarchy; Geist Mono `tabular-nums` for every number.
- Negative tracking on large text; positive on UPPERCASE labels.
- Depth from surface contrast; whisper shadows only.
- Accent ≤2× per screen; neutral chrome otherwise.

**Don't**
- ❌ Multicolor decorative icons in pickers/chrome (the old Quick-Add icons).
- ❌ `shadow-glow*` on buttons or as ambient decoration.
- ❌ A third typeface, or Inter 300 for small UI text.
- ❌ Sharp corners (<8px) on interactive elements.
- ❌ Gradients as decoration (the circadian canvas is the one sanctioned gradient).
- ❌ Touching `app/api/**`, the DB schema, auth, or PWA/service-worker wiring for a *visual* task.
