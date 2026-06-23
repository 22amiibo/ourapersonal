import Link from "next/link";
import SourcesManager from "@/app/components/articles/SourcesManager";

export const dynamic = "force-dynamic";

export default function SourcesPage() {
  return (
    <main className="mx-auto max-w-md pb-28 pt-5">
      <header className="px-5 pb-3 animate-fade-in">
        <Link href="/articles" className="text-[13px] font-medium text-ink-3">
          ‹ Articles
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">Sources</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          Newsletters are pulled from your dedicated mailbox. Add the senders you forward.
        </p>
      </header>
      <div className="px-4">
        <SourcesManager />
      </div>
    </main>
  );
}
