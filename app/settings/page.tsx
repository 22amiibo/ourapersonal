"use client";

import { useEffect, useState, useCallback } from "react";

const OURA_STATUS: Record<string, string> = {
  connected: "Oura connected.",
  denied: "You declined the Oura authorization.",
  bad_state: "Oura sign-in expired — please try Connect again.",
  missing_code: "Oura didn't return a code — try again.",
  error: "Something went wrong connecting Oura.",
};

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney",
];

const GOAL_KINDS = [
  { kind: "sleep_hours_gte", label: "Sleep ≥ hours/night", placeholder: "e.g. 7.5" },
  { kind: "reflect_daily", label: "Reflect daily", placeholder: "" },
  { kind: "caffeine_before_hour", label: "Caffeine before hour", placeholder: "e.g. 14" },
  { kind: "alcohol_free_days_per_week", label: "Alcohol-free days/week", placeholder: "e.g. 5" },
  { kind: "readiness_gte", label: "Readiness ≥ score", placeholder: "e.g. 70" },
];

type Goal = { id: number; kind: string; label: string; target_json: unknown; active: boolean };

function urlB64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
  return arr.buffer;
}

export default function SettingsPage() {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [ouraMsg, setOuraMsg] = useState("");
  const [ouraStatus, setOuraStatus] = useState<"idle" | "error" | "success">("idle");
  const [syncLoading, setSyncLoading] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [tzSaving, setTzSaving] = useState(false);

  // Notifications
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const [notifLoading, setNotifLoading] = useState(false);

  // Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalKind, setNewGoalKind] = useState(GOAL_KINDS[0].kind);
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [goalMsg, setGoalMsg] = useState("");

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      if (res.ok) {
        const d = await res.json();
        setGoals(d.goals ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const o = params.get("oura");
    if (o && OURA_STATUS[o]) {
      setOuraMsg(OURA_STATUS[o]);
      setOuraStatus(o === "connected" ? "success" : o === "error" ? "error" : "idle");
    }

    fetch("/api/calendar").then((r) => r.json()).then((d) => { if (d.url) setUrl(d.url); }).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((d) => { if (d.timezone) setTimezone(d.timezone); }).catch(() => {});
    loadGoals();

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotifStatus("unsupported");
    } else {
      setNotifStatus(Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "idle");
    }
  }, [loadGoals]);

  async function saveTimezone() {
    setTzSaving(true);
    setMsg("");
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone }) });
    const d = await res.json();
    setMsg(d.ok ? "Timezone saved." : d.error || "Error");
    setTzSaving(false);
  }

  async function saveCal() {
    setMsg("Saving…");
    const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", url }) });
    const d = await res.json();
    setMsg(d.ok ? "Calendar URL saved." : d.error || "Error");
  }

  async function syncCal() {
    setSyncLoading(true);
    setMsg("");
    const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
    const d = await res.json();
    setMsg(d.ok ? `Synced ${d.synced} events.` : d.error || "Error");
    setSyncLoading(false);
  }

  async function enableNotifications() {
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotifStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-key");
      if (!keyRes.ok) { setMsg("Push not configured on server."); return; }
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setNotifStatus("granted");
      setMsg("Notifications enabled.");
    } catch (e) {
      setMsg(`Notifications failed: ${String(e)}`);
    } finally {
      setNotifLoading(false);
    }
  }

  async function addGoal() {
    const kindDef = GOAL_KINDS.find((g) => g.kind === newGoalKind)!;
    const label = kindDef.label;
    const target = newGoalTarget.trim() ? { value: Number(newGoalTarget) } : null;
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: newGoalKind, label, target_json: target }),
    });
    const d = await res.json();
    if (d.ok) { setGoalMsg("Goal added."); setNewGoalTarget(""); loadGoals(); }
    else setGoalMsg(d.error ?? "Error");
  }

  async function removeGoal(id: number) {
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    loadGoals();
  }

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      </header>

      {/* Oura */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Oura ring</p>
        <p className="text-sm text-ink-2">Connect your Oura Ring to sync sleep, readiness, and activity data.</p>
        <a href="/api/oura/connect" className="block rounded-control bg-accent px-4 py-3.5 text-center font-medium text-bg transition-all duration-200 active:scale-[0.98] min-h-[44px]">
          Connect Oura
        </a>
        {ouraMsg && (
          <div className={`rounded-control border p-3 text-sm ${ouraStatus === "success" ? "border-accent/30 bg-accent/5 text-accent" : ouraStatus === "error" ? "border-rose/30 bg-rose/5 text-rose" : "border-line bg-bg text-ink-2"}`}>
            {ouraMsg}
          </div>
        )}
      </section>

      {/* Notifications */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Notifications</p>
        {notifStatus === "unsupported" ? (
          <p className="text-sm text-ink-2">Web Push requires installing this app to your home screen on iOS 16.4+.</p>
        ) : notifStatus === "granted" ? (
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <p className="text-sm text-ink-2">Notifications enabled. You'll get morning briefings and evening nudges.</p>
          </div>
        ) : notifStatus === "denied" ? (
          <p className="text-sm text-ink-2">Notifications are blocked. Allow them in iOS Settings → Safari → Notifications.</p>
        ) : (
          <>
            <p className="text-sm text-ink-2">Get morning briefing push and evening reflection nudges.</p>
            <button
              onClick={enableNotifications}
              disabled={notifLoading}
              className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
            >
              {notifLoading ? "Enabling…" : "Enable Notifications"}
            </button>
          </>
        )}
      </section>

      {/* Calendar */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Calendar</p>
        <div className="space-y-2">
          <label className="text-sm text-ink-2">Google Calendar .ics feed URL</label>
          <p className="text-xs text-ink-3">In Google Calendar: Settings → your calendar → "Secret address in iCal format"</p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink placeholder-ink-3 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={saveCal} className="flex-1 rounded-control bg-accent px-4 py-3.5 font-medium text-bg transition-all duration-200 active:scale-[0.98] min-h-[44px]">Save URL</button>
          <button onClick={syncCal} disabled={syncLoading} className="flex-1 rounded-control border border-line bg-bg px-4 py-3.5 font-medium text-ink transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[44px]">
            {syncLoading ? <span className="flex items-center justify-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" /></span> : "Sync"}
          </button>
        </div>
      </section>

      {/* Timezone */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Timezone</p>
        <p className="text-sm text-ink-2">Used to compute your day, weekly rollups, and greetings.</p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={saveTimezone} disabled={tzSaving} className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[44px]">
          {tzSaving ? <span className="flex items-center justify-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" /></span> : "Save Timezone"}
        </button>
      </section>

      {/* Goals */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Goals</p>
        {goals.length > 0 && (
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-control border border-line bg-bg/40 px-3 py-2.5">
                <span className="text-sm text-ink">{g.label}</span>
                <button onClick={() => removeGoal(g.id)} className="text-xs text-ink-3 transition-colors hover:text-rose active:scale-95">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <select
            value={newGoalKind}
            onChange={(e) => setNewGoalKind(e.target.value)}
            className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {GOAL_KINDS.map((g) => <option key={g.kind} value={g.kind}>{g.label}</option>)}
          </select>
          {GOAL_KINDS.find((g) => g.kind === newGoalKind)?.placeholder && (
            <input
              value={newGoalTarget}
              onChange={(e) => setNewGoalTarget(e.target.value)}
              placeholder={GOAL_KINDS.find((g) => g.kind === newGoalKind)?.placeholder}
              type="number"
              className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            />
          )}
          <button onClick={addGoal} className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm font-medium text-ink transition-all duration-200 active:scale-[0.98] min-h-[44px]">
            Add Goal
          </button>
        </div>
        {goalMsg && <p className={`text-sm ${goalMsg.includes("Error") || goalMsg.includes("error") ? "text-rose" : "text-accent"}`}>{goalMsg}</p>}
      </section>

      {/* Export */}
      <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Export data</p>
        <p className="text-sm text-ink-2">Download all your reflections, intake logs, Oura data, and briefings.</p>
        <div className="flex gap-2">
          <a href="/api/export?format=json" download className="flex-1 rounded-control border border-line bg-bg px-4 py-3.5 text-center text-sm font-medium text-ink transition-all duration-200 active:scale-[0.98] min-h-[44px]">
            JSON
          </a>
          <a href="/api/export?format=csv" download className="flex-1 rounded-control border border-line bg-bg px-4 py-3.5 text-center text-sm font-medium text-ink transition-all duration-200 active:scale-[0.98] min-h-[44px]">
            CSV
          </a>
        </div>
      </section>

      {msg && (
        <div className={`rounded-control border p-3.5 text-sm ${msg.includes("Error") || msg.includes("error") || msg.includes("failed") ? "border-rose/30 bg-rose/5 text-rose" : "border-accent/30 bg-accent/5 text-accent"}`}>
          {msg}
        </div>
      )}
    </main>
  );
}
