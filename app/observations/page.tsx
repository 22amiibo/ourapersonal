import ObservationsClient from "@/app/components/observations/ObservationsClient";

export const dynamic = "force-dynamic";

export default function ObservationsPage() {
  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <h1 className="text-display font-semibold text-ink">Observations</h1>
        <p className="mt-0.5 px-0 text-[14px] text-ink-2">
          Your reflections, interwoven with AI interpretation of your data.
        </p>
      </header>
      <ObservationsClient />
    </main>
  );
}
