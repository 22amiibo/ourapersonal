"use client";

import { useState } from "react";

export default function ReflectPage() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function save() {
    setStatus("saving");
    setMsg("");
    const res = await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setStatus("done");
      setMsg(data.extracted ? "Saved and analyzed." : "Saved (analysis will retry later).");
      setText("");
    } else {
      setStatus("error");
      setMsg(data.error || "Something went wrong.");
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Evening reflection</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          A few moments to reflect on your day.
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">What happened today</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Studied biology for 2 hours, finished chapter 5… confidence about 7/10. Didn't get to calc."
          className="w-full rounded-control border border-line bg-surface px-4 py-3 text-ink placeholder-ink-3 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      </section>

      <button
        onClick={save}
        disabled={status === "saving" || !text.trim()}
        className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 min-h-[44px]"
      >
        {status === "saving" ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
            Saving…
          </span>
        ) : (
          "Save reflection"
        )}
      </button>

      {msg && (
        <div className={`rounded-control border p-3.5 text-sm ${
          status === "error"
            ? "border-rose/30 bg-rose/5 text-rose"
            : "border-accent/30 bg-accent/5 text-accent"
        }`}>
          {msg}
        </div>
      )}
    </main>
  );
}
