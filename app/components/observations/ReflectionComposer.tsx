"use client";

import { useState } from "react";

// Writes a reflection via the existing /api/reflections endpoint (which also
// runs Claude metadata extraction). Calls onSaved so the timeline can refresh.
export default function ReflectionComposer({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      if (r.ok) {
        setText("");
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card glass-1 p-4">
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind? A thought, a struggle, what changed today…"
        className="w-full resize-none rounded-control border border-line bg-bg px-3.5 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={save}
        disabled={busy || !text.trim()}
        className="mt-2.5 min-h-[44px] w-full rounded-pill bg-accent px-5 py-3 text-[14px] font-semibold text-bg active:scale-95 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Add reflection"}
      </button>
    </div>
  );
}
