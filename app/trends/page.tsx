// Trends tab — filled in Phase 4 (highlight cards + D/W/M detail from computeTrends).
export const dynamic = "force-dynamic";

export default function TrendsPage() {
  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Trends</h1>
      </header>
      <div className="space-y-3 px-4">
        <div className="h-40 rounded-card skeleton" />
        <div className="h-40 rounded-card skeleton" />
      </div>
    </main>
  );
}
