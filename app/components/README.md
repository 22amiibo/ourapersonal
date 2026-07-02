# app/components/ — UI components by domain

Design contract: `docs/EXPO_DESIGN_GUIDE.md`; tokens (teal `#14b8a6`, SF Pro Rounded) in
`app/globals.css`. Always reuse `ui/` primitives; never create parallel ones. Motion: respect reduced-motion and the
once-per-session reveal gate (`lib/motion.ts`, `RevealGate`).

## Root (app shell)
`NavShell` (chrome wrapper) · `TabBar` (6 bottom tabs) · `CommandPalette` (⌘K — keeps its own
route list, not unified with TabBar) · `MoreButton`/`MoreSheet` (gear menu → Settings/Weekly/
Insights) · `StatusBar` · `CircadianBackground` (time-of-day canvas) · `RevealGate`
(once-per-session entrance animations) · `ServiceWorkerRegistration` · `nav/secondaryNav`.

## Subfolders
- **`ui/`** — generic primitives: `GlassCard`/`SolidCard` (surfaces), `Button`, `MetricCard`,
  `Ring`, `Sparkline`, `TrendChart`, `ChartContainer`, `CalendarHeatmap`, `SleepStageBar`,
  `ReadinessContributors`, `CorrelationBar`, `CountUp`, `HapticReveal`, `Skeleton`,
  `QuoteBanner`, `TopHeaderRow`, `FxButtonRow`, `VoiceWave`.
- **`cards/`** — Summary-screen domain cards: `ZStatsCard` (sleep), `WorkoutCard`, `TasksCard`,
  `WeeklyInsightsCard`, `PrayerCard`, `QuranCard`, `AdhkarRow`, `CounterRow`.
- **`trends/`** — Trends tab: `TrendsClient` (screen), `MetricBarChart`, `MetricDetailView`,
  `MetricHighlightCard`, `TimeRangeToggle`, `TrendPill`, `metricMeta.ts` (per-metric labels/units —
  edit here when adding a metric).
- **`inputs/`** — Log tab controls: `CaffeineSlider` (25mg steps), `AlcoholCounter`, `MoodSlider`,
  `WorkoutSlider` → POST to `/api/log/*`.
- **`articles/`** — `ArticlesClient` (screen), `ArticleCard`, `ArticleReader` (sanitized HTML),
  `SourcesManager`, `types.ts`.
- **`observations/`** — `ObservationsClient` (screen), `ObservationCard`, `ReflectionComposer`.
