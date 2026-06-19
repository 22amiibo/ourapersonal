"use client";

import { useEffect, useState } from "react";

const OURA_STATUS: Record<string, string> = {
  connected: "Oura connected.",
  denied: "You declined the Oura authorization.",
  bad_state: "Oura sign-in expired — please try Connect again.",
  missing_code: "Oura didn't return a code — try again.",
  error: "Something went wrong connecting Oura.",
};

export default function SettingsPage() {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [ouraMsg, setOuraMsg] = useState("");
  const [ouraStatus, setOuraStatus] = useState<"idle" | "error" | "success">("idle");
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const o = params.get("oura");
    if (o && OURA_STATUS[o]) {
      setOuraMsg(OURA_STATUS[o]);
      setOuraStatus(o === "connected" ? "success" : o === "error" ? "error" : "idle");
    }
  }, []);

  async function saveCal() {
    setMsg("Saving…");
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", url }),
    });
    const d = await res.json();
    setMsg(d.ok ? "Calendar URL saved." : d.error || "Error");
  }

  async function syncCal() {
    setSyncLoading(true);
    setMsg("");
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const d = await res.json();
    setMsg(d.ok ? `Synced ${d.synced} events.` : d.error || "Error");
    setSyncLoading(false);
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      </header>

      {/* Oura section */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Oura ring</p>
        <p className="text-sm text-ink-2">
          Connect your Oura Ring to sync sleep, readiness, and activity data.
        </p>
        <a
          href="/api/oura/connect"
          className="block rounded-control bg-accent px-4 py-3.5 text-center font-medium text-bg transition-all duration-200 active:scale-[0.98] min-h-[44px]"
        >
          Connect Oura
        </a>
        {ouraMsg && (
          <div className={`rounded-control border p-3 text-sm ${
            ouraStatus === "success"
              ? "border-accent/30 bg-accent/5 text-accent"
              : ouraStatus === "error"
                ? "border-rose/30 bg-rose/5 text-rose"
                : "border-line bg-bg text-ink-2"
          }`}>
            {ouraMsg}
          </div>
        )}
      </section>

      {/* Calendar section */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Calendar</p>
        <div className="space-y-2">
          <label className="text-sm text-ink-2">
            Google Calendar .ics feed URL
          </label>
          <p className="text-xs text-ink-3">
            In Google Calendar: Settings → your calendar → "Secret address in iCal format"
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink placeholder-ink-3 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={saveCal}
            className="flex-1 rounded-control bg-accent px-4 py-3.5 font-medium text-bg transition-all duration-200 active:scale-[0.98] min-h-[44px]"
          >
            Save URL
          </button>
          <button
            onClick={syncCal}
            disabled={syncLoading}
            className="flex-1 rounded-control border border-line bg-bg px-4 py-3.5 font-medium text-ink transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
          >
            {syncLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
              </span>
            ) : (
              "Sync"
            )}
          </button>
        </div>
      </section>

      {msg && (
        <div className={`rounded-control border p-3.5 text-sm ${
          msg.includes("Error") || msg.includes("error")
            ? "border-rose/30 bg-rose/5 text-rose"
            : "border-accent/30 bg-accent/5 text-accent"
        }`}>
          {msg}
        </div>
      )}
    </main>
  );
}
