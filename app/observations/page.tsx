// Observations tab — filled in Phase 6 (reflection composer + AI observation cards).
export const dynamic = "force-dynamic";

export default function ObservationsPage() {
  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Observations</h1>
      </header>
      <div className="space-y-3 px-4">
        <div className="h-32 rounded-card skeleton" />
        <div className="h-24 rounded-card skeleton" />
      </div>
    </main>
  );
}
