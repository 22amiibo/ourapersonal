"use client";

import { useEffect, useState } from "react";
import type { Source } from "./types";

export default function SourcesManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [kind, setKind] = useState<"rss" | "email">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const r = await fetch("/api/sources");
    if (r.ok) {
      const { sources: rows } = (await r.json()) as { sources: Source[] };
      setSources(rows);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim() || !identifier.trim()) {
      setError("Name and identifier are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, identifier }),
      });
      if (r.ok) {
        setName("");
        setIdentifier("");
        await load();
      } else {
        const e = await r.json().catch(() => ({}));
        setError((e as { error?: string }).error ?? "Failed to add source.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: Source) {
    await fetch("/api/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card glass-1 p-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Add source</p>
        <div className="space-y-2.5">
          <div className="flex gap-2">
            {(["email", "rss"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="flex-1 rounded-control py-2 text-[13px] font-semibold transition-colors"
                style={
                  kind === k
                    ? { background: "color-mix(in oklch, var(--color-accent) 22%, transparent)", color: "var(--color-accent)" }
                    : { background: "var(--color-bg-soft)", color: "var(--color-ink-3)" }
                }
              >
                {k === "email" ? "Email" : "RSS"}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Morning Brew)"
            className="w-full rounded-control border border-line bg-bg px-3.5 py-3 text-[14px] text-ink focus:border-accent focus:outline-none"
          />
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={kind === "email" ? "Sender email (forwarded from)" : "Feed URL"}
            className="w-full rounded-control border border-line bg-bg px-3.5 py-3 text-[14px] text-ink focus:border-accent focus:outline-none"
          />
          {error && <p className="text-[12px] text-rose">{error}</p>}
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="min-h-[44px] w-full rounded-pill bg-accent px-5 py-3 text-[14px] font-semibold text-bg active:scale-95 disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add source"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sources.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-3">No sources yet.</p>
        ) : (
          sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-card glass-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{s.name}</p>
                <p className="truncate text-[12px] text-ink-3">
                  {s.kind} · {s.identifier}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(s)}
                className="rounded-pill px-3 py-1.5 text-[12px] font-semibold"
                style={
                  s.active
                    ? { background: "color-mix(in oklch, var(--color-accent) 22%, transparent)", color: "var(--color-accent)" }
                    : { background: "var(--color-bg-soft)", color: "var(--color-ink-3)" }
                }
              >
                {s.active ? "Active" : "Paused"}
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`Remove ${s.name}`}
                className="text-ink-3 transition-colors hover:text-rose"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
