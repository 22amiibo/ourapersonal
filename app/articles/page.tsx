// Articles tab — filled in Phase 5 (newsletter list + in-app reader).
export const dynamic = "force-dynamic";

export default function ArticlesPage() {
  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Articles</h1>
      </header>
      <div className="space-y-4 px-4">
        <div className="h-64 rounded-card skeleton" />
        <div className="h-64 rounded-card skeleton" />
      </div>
    </main>
  );
}
