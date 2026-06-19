"use client";

import { useState, useTransition } from "react";

export type IntakeEntry = {
  id: number;
  type: "caffeine" | "alcohol" | "note";
  quantity: number;
  unit: string;
  timestamp: string;
  note: string | null;
};

type ModalState = { type: "caffeine" | "alcohol" | "note" } | null;

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CoffeeIcon() {
  return (
    <svg
      className="h-7 w-7 text-amber"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function DrinkIcon() {
  return (
    <svg
      className="h-7 w-7 text-rose"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 22h8M12 11v11M3 2l2.5 14.5a2 2 0 0 0 2 1.5h9a2 2 0 0 0 2-1.5L21 2H3z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg
      className="h-7 w-7 text-ink-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export default function LogTab({ initialEntries }: { initialEntries: IntakeEntry[] }) {
  const [entries, setEntries] = useState<IntakeEntry[]>(initialEntries);
  const [modal, setModal] = useState<ModalState>(null);
  const [quantity, setQuantity] = useState("");
  const [noteText, setNoteText] = useState("");
  const [timestamp, setTimestamp] = useState(nowDatetimeLocal);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function openModal(type: "caffeine" | "alcohol" | "note") {
    setQuantity(type === "caffeine" ? "100" : type === "alcohol" ? "1" : "");
    setNoteText("");
    setTimestamp(nowDatetimeLocal());
    setError("");
    setModal({ type });
  }

  function closeModal() {
    setModal(null);
  }

  function submit() {
    if (!modal) return;

    let body: Record<string, unknown>;

    if (modal.type === "note") {
      if (!noteText.trim()) {
        setError("Enter a note.");
        return;
      }
      body = {
        type: "note",
        quantity: 0,
        unit: "",
        timestamp: new Date(timestamp).toISOString(),
        note: noteText.trim(),
      };
    } else {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        setError("Enter a valid quantity.");
        return;
      }
      body = {
        type: modal.type,
        quantity: qty,
        unit: modal.type === "caffeine" ? "mg" : "drinks",
        timestamp: new Date(timestamp).toISOString(),
        note: noteText.trim() || undefined,
      };
    }

    startTransition(async () => {
      const res = await fetch("/api/log/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const { entry } = (await res.json()) as { entry: IntakeEntry };
        setEntries((prev) => [entry, ...prev]);
        closeModal();
      } else {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Failed to save.");
      }
    });
  }

  const todayCaffeine = entries
    .filter((e) => e.type === "caffeine")
    .reduce((sum, e) => sum + e.quantity, 0);
  const todayAlcohol = entries
    .filter((e) => e.type === "alcohol")
    .reduce((sum, e) => sum + e.quantity, 0);

  const modalTitle =
    modal?.type === "caffeine"
      ? "Log Caffeine"
      : modal?.type === "alcohol"
      ? "Log Alcohol"
      : "Log Note";

  return (
    <>
      <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Log</h1>
          <p className="mt-0.5 text-sm text-ink-2">Track today's intake</p>
        </header>

        {/* Day totals */}
        <div className="flex gap-2.5">
          <div className="flex-1 rounded-card border border-line bg-surface p-3.5 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Caffeine</p>
            <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">
              {todayCaffeine}
              <span className="ml-1 text-xs font-normal text-ink-3">mg</span>
            </p>
          </div>
          <div className="flex-1 rounded-card border border-line bg-surface p-3.5 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Alcohol</p>
            <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">
              {todayAlcohol}
              <span className="ml-1 text-xs font-normal text-ink-3">drinks</span>
            </p>
          </div>
        </div>

        {/* Intake buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => openModal("caffeine")}
            className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-3.5 shadow-card transition-transform active:scale-[0.97]"
          >
            <CoffeeIcon />
            <span className="text-xs font-medium text-ink">Caffeine</span>
          </button>
          <button
            onClick={() => openModal("alcohol")}
            className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-3.5 shadow-card transition-transform active:scale-[0.97]"
          >
            <DrinkIcon />
            <span className="text-xs font-medium text-ink">Alcohol</span>
          </button>
          <button
            onClick={() => openModal("note")}
            className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-3.5 shadow-card transition-transform active:scale-[0.97]"
          >
            <NoteIcon />
            <span className="text-xs font-medium text-ink">Note</span>
          </button>
        </div>

        {/* Timeline */}
        <section>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-ink-3">
            Today's entries
          </p>
          {entries.length === 0 ? (
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="text-sm text-ink-3">
                No entries yet. Tap a button above to log intake.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-card border border-line bg-surface p-3.5 shadow-card"
                >
                  <span className="mt-0.5 text-lg" aria-hidden>
                    {entry.type === "caffeine" ? "☕" : entry.type === "alcohol" ? "🍷" : "📝"}
                  </span>
                  <div className="min-w-0 flex-1">
                    {entry.type === "note" ? (
                      <span className="text-[11px] text-ink-3">{formatTime(entry.timestamp)}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium tabular-nums text-ink">
                          {entry.quantity} {entry.unit}
                        </span>
                        <span className="text-[11px] text-ink-3">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                    )}
                    {entry.note && (
                      <p
                        className={`mt-0.5 text-xs ${
                          entry.type === "note" ? "text-ink" : "truncate text-ink-3"
                        }`}
                      >
                        {entry.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Bottom sheet modal */}
      {modal && (
        <div
          className="fixed inset-0 z-30 flex items-end"
          style={{ background: "rgba(11,12,14,0.7)", backdropFilter: "blur(4px)" }}
          onClick={closeModal}
        >
          <div
            className="w-full rounded-t-[20px] border-t border-line bg-surface px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" />

            <h2 className="mb-5 text-lg font-semibold text-ink">{modalTitle}</h2>

            <div className="space-y-4">
              {modal.type === "note" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-3">Note</label>
                  <textarea
                    rows={4}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full resize-none rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-3">
                      {modal.type === "caffeine" ? "Amount (mg)" : "Drinks"}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={modal.type === "caffeine" ? "e.g. 100" : "e.g. 1"}
                      className="w-full rounded-control border border-line bg-bg px-4 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-3">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder={
                        modal.type === "caffeine"
                          ? "e.g. Espresso after lunch"
                          : "e.g. Glass of wine"
                      }
                      className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-3">Time</label>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full rounded-control border border-line bg-bg px-4 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              {error && <p className="text-xs text-rose">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeModal}
                  className="flex-1 rounded-control border border-line py-3.5 text-sm font-medium text-ink-2 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={isPending}
                  className="flex-1 rounded-control bg-accent py-3.5 text-sm font-medium text-bg disabled:opacity-50 min-h-[44px]"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
