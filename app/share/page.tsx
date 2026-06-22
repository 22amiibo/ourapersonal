"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Button from "@/app/components/ui/Button";

function ShareContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const incoming = [params.get("text"), params.get("title"), params.get("url")]
      .filter(Boolean)
      .join("\n\n");
    setText(incoming);
  }, [params]);

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setStatus("done");
      setMsg("Saved as a reflection.");
      setTimeout(() => router.push("/reflect"), 1500);
    } else {
      setStatus("error");
      setMsg(data.error ?? "Error saving.");
    }
  }

  async function logNote() {
    setStatus("saving");
    const res = await fetch("/api/log/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "note", quantity: 0, unit: "", note: text }),
    });
    const data = await res.json();
    if (res.ok && data.entry) {
      setStatus("done");
      setMsg("Saved as a log note.");
      setTimeout(() => router.push("/log"), 1500);
    } else {
      setStatus("error");
      setMsg("Error saving note.");
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Quick capture</h1>
        <p className="mt-0.5 text-sm text-ink-2">Save shared content to your dashboard.</p>
      </header>

      <section className="rounded-card glass-1 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      </section>

      {msg && (
        <div className={`rounded-control border p-3.5 text-sm ${status === "error" ? "border-rose/30 bg-rose/5 text-rose" : "border-line bg-surface-2 text-ink-2"}`}>
          {msg}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="accent" onClick={save} disabled={status === "saving" || !text.trim()} className="flex-1">
          Save as reflection
        </Button>
        <Button variant="secondary" onClick={logNote} disabled={status === "saving" || !text.trim()} className="flex-1">
          Log note
        </Button>
      </div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareContent />
    </Suspense>
  );
}
