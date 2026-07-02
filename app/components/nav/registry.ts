// The single source of truth for every navigable destination.
// TabBar (primary tabs), NavShell's rail (all), the global More sheet
// (secondary), and the command palette (all) each derive their lists from
// here — adding or moving a route means editing THIS file only.
//
// Icons live in ./NavIcon.tsx, keyed by `id`, so every surface renders the
// same glyph for the same destination.

export type NavGroup = "primary" | "secondary";

export type NavRoute = {
  /** Stable key — also the icon key in NavIcon.tsx. */
  id: string;
  href: string;
  label: string;
  /** One-line subtitle shown in the command palette. */
  hint: string;
  /** Extra search terms for the command palette. */
  keywords: string;
  group: NavGroup;
  /** Custom active-state matcher; default is exact-or-prefix on href. */
  match?: (path: string) => boolean;
};

export const NAV_ROUTES: NavRoute[] = [
  // ── Primary — the 5-tab bottom bar ─────────────────────────────
  {
    id: "today",
    href: "/dashboard",
    label: "Today",
    hint: "Briefing, rings & your day",
    keywords: "home dashboard briefing today summary readiness",
    group: "primary",
    match: (p) => p === "/" || p === "/dashboard" || p.startsWith("/dashboard/"),
  },
  {
    id: "health",
    href: "/health",
    label: "Health",
    hint: "Sleep, recovery & body",
    keywords: "health sleep recovery hrv heart body stages correlations",
    group: "primary",
  },
  {
    id: "insights",
    href: "/insights",
    label: "Insights",
    hint: "Ask your data & patterns",
    keywords: "insights patterns intelligence ask ai coach observations notes timeline",
    group: "primary",
  },
  {
    id: "reflect",
    href: "/reflect",
    label: "Reflect",
    hint: "Log your day & write tonight's reflection",
    keywords: "reflect journal write evening reflection inputs log caffeine alcohol workout mood intake add",
    group: "primary",
  },
  {
    id: "progress",
    href: "/achievements",
    label: "Progress",
    hint: "Awards & milestones",
    keywords: "progress achievements awards milestones badges streaks",
    group: "primary",
  },

  // ── Secondary — global More sheet, rail, palette ───────────────
  {
    id: "weekly",
    href: "/weekly",
    label: "Weekly",
    hint: "Weekly review",
    keywords: "weekly review summary rollup",
    group: "secondary",
  },
  {
    id: "articles",
    href: "/articles",
    label: "Articles",
    hint: "Newsletter reader",
    keywords: "articles newsletter read email",
    group: "secondary",
  },
  {
    id: "sources",
    href: "/settings/sources",
    label: "Sources",
    hint: "Newsletter senders",
    keywords: "sources senders newsletters mailbox",
    group: "secondary",
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    hint: "Connections & account",
    keywords: "settings oura connect account preferences",
    group: "secondary",
    // Exclude /settings/sources so the Sources row, not Settings, lights up.
    match: (p) =>
      p === "/settings" ||
      (p.startsWith("/settings/") && !p.startsWith("/settings/sources")),
  },
];

export const PRIMARY_NAV: NavRoute[] = NAV_ROUTES.filter(
  (r) => r.group === "primary"
);
export const SECONDARY_NAV: NavRoute[] = NAV_ROUTES.filter(
  (r) => r.group === "secondary"
);

export function isRouteActive(route: NavRoute, path: string): boolean {
  if (route.match) return route.match(path);
  return path === route.href || path.startsWith(route.href + "/");
}
