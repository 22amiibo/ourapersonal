# app/ — Next.js 16 App Router

Shared chrome: `layout.tsx` (fonts, PWA meta) → `template.tsx` (page transitions) →
`components/NavShell`. Auth gating lives in root `proxy.ts` (Next 16's middleware), not here.
Styling tokens: `globals.css` (`@theme`) — the design-token source of truth.

## Pages (bottom tabs)
| Route | Screen |
|---|---|
| `/` (`page.tsx`) | Summary — rings, briefing, domain cards |
| `/trends` | Trends — metric charts (D/W/M) |
| `/observations` | Observations — AI notes + reflection composer |
| `/log` | Inputs — manual logging (`LogTab.tsx`) |
| `/articles` | Articles — newsletter reader |
| `/achievements` | Awards — achievement grid (+ `UnlockToast`) |

## Other pages (via More menu / direct)
| Route | Screen |
|---|---|
| `/dashboard` | Detailed metrics dashboard (`Metrics`, `OuraDetails`, `HabitCheckins`, `RunButton`) |
| `/insights` | Weekly insights + "Ask your data" (`AskData.tsx`) |
| `/weekly` | Weekly rollup (+ share button) |
| `/health` | Health tab detail (`HealthTab.tsx`) |
| `/reflect` | Journal entry |
| `/settings`, `/settings/sources` | Settings, newsletter sources |
| `/login`, `/onboarding`, `/share` | Auth, first-run, share view |

`api/` → see `app/api/README.md`. `components/` → see `app/components/README.md`.
