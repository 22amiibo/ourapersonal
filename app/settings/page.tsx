"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/app/components/ui/Button";

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
  { kind: "sleep_hours_gte",             label: "Sleep ≥ hours/night",        placeholder: "e.g. 7.5" },
  { kind: "reflect_daily",               label: "Reflect daily",              placeholder: "" },
  { kind: "caffeine_before_hour",        label: "No caffeine after hour",     placeholder: "e.g. 14" },
  { kind: "alcohol_free_days_per_week",  label: "Alcohol-free days/week",     placeholder: "e.g. 5" },
  { kind: "readiness_gte",              label: "Readiness ≥ score",           placeholder: "e.g. 70" },
  { kind: "workout_days_per_week",       label: "Workout days/week",          placeholder: "e.g. 4" },
  { kind: "no_phone_before_hour",        label: "No phone before hour",       placeholder: "e.g. 8" },
  { kind: "meditation_minutes",          label: "Meditate ≥ minutes/day",     placeholder: "e.g. 10" },
  { kind: "deep_work_hours",             label: "Deep work ≥ hours/day",      placeholder: "e.g. 3" },
  { kind: "bed_by_hour",                 label: "In bed by hour",             placeholder: "e.g. 23" },
];

type Goal = { id: number; kind: string; label: string; target_json: unknown; active: boolean };

function urlB64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
  return arr.buffer;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
      {children}
    </p>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 overflow-hidden rounded-card glass-1">
      {children}
    </div>
  );
}

function Row({ children, noBorder = false }: { children: React.ReactNode; noBorder?: boolean }) {
  return (
    <>
      <div className="flex min-h-[52px] items-center justify-between px-5 py-3.5">
        {children}
      </div>
      {!noBorder && <div className="mx-5 h-px bg-line" />}
    </>
  );
}

function InlineMsg({ msg, isError }: { msg: string; isError?: boolean }) {
  if (!msg) return null;
  return (
    <p className={`px-4 mt-1.5 text-[13px] ${isError ? "text-rose" : "text-ink-2"}`}>{msg}</p>
  );
}

export default function SettingsPage() {
  const [url, setUrl] = useState("");
  const [calMsg, setCalMsg] = useState("");
  const [ouraMsg, setOuraMsg] = useState("");
  const [ouraStatus, setOuraStatus] = useState<"idle" | "error" | "success">("idle");
  const [syncLoading, setSyncLoading] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [tzSaving, setTzSaving] = useState(false);
  const [tzMsg, setTzMsg] = useState("");
  const [windDownTime, setWindDownTime] = useState("");
  const [windDownSaving, setWindDownSaving] = useState(false);
  const [windDownMsg, setWindDownMsg] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [locSaving, setLocSaving] = useState(false);
  const [locMsg, setLocMsg] = useState("");

  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null);
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "unsupported" | "needsInstall">("idle");
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");

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
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.timezone) setTimezone(d.timezone);
      if (d.wind_down_time) setWindDownTime(d.wind_down_time);
      if (d.lat) setLat(d.lat);
      if (d.lon) setLon(d.lon);
      setOuraConnected(d.ouraConnected ?? false);
    }).catch(() => {});
    loadGoals();

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotifStatus("unsupported");
    } else {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const pushAvailable = "PushManager" in window;
      if (!pushAvailable && !isStandalone) {
        setNotifStatus("needsInstall");
      } else {
        setNotifStatus(Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "idle");
      }
    }
  }, [loadGoals]);

  async function saveTimezone() {
    setTzSaving(true);
    setTzMsg("");
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone }) });
    const d = await res.json();
    setTzMsg(d.ok ? "Timezone saved." : d.error || "Error");
    setTzSaving(false);
  }

  async function saveWindDown() {
    setWindDownSaving(true);
    setWindDownMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wind_down_time: windDownTime || null }),
    });
    const d = await res.json();
    setWindDownMsg(d.ok ? "Wind-down time saved." : d.error || "Error");
    setWindDownSaving(false);
  }

  async function saveLocation() {
    setLocSaving(true);
    setLocMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        lat.trim() && lon.trim()
          ? { location: { lat: Number(lat), lon: Number(lon) } }
          : { location: null },
      ),
    });
    const d = await res.json();
    setLocMsg(d.ok ? "Location saved — weather sync starts on the next daily job." : d.error || "Error");
    setLocSaving(false);
  }

  async function saveCal() {
    setCalMsg("Saving…");
    const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", url }) });
    const d = await res.json();
    setCalMsg(d.ok ? "Calendar URL saved." : d.error || "Error");
  }

  async function syncCal() {
    setSyncLoading(true);
    setCalMsg("");
    const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
    const d = await res.json();
    setCalMsg(d.ok ? `Synced ${d.synced} events.` : d.error || "Error");
    setSyncLoading(false);
  }

  async function enableNotifications() {
    setNotifLoading(true);
    setNotifMsg("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotifStatus("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-key");
      if (!keyRes.ok) { setNotifMsg("Push not configured on server."); return; }
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
      setNotifMsg("Notifications enabled.");
    } catch (e) {
      setNotifMsg(`Failed: ${String(e)}`);
    } finally {
      setNotifLoading(false);
    }
  }

  async function disableNotifications() {
    setNotifLoading(true);
    setNotifMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
        await sub.unsubscribe();
      }
      setNotifStatus("idle");
      setNotifMsg("Notifications disabled.");
    } catch (e) {
      setNotifMsg(`Failed: ${String(e)}`);
    } finally {
      setNotifLoading(false);
    }
  }

  async function sendTestNotification() {
    setNotifLoading(true);
    setNotifMsg("");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const d = await res.json();
      setNotifMsg(d.ok ? "Test notification sent — check your device." : d.error || "Failed to send test.");
    } catch (e) {
      setNotifMsg(`Failed: ${String(e)}`);
    } finally {
      setNotifLoading(false);
    }
  }

  async function addGoal() {
    const kindDef = GOAL_KINDS.find((g) => g.kind === newGoalKind)!;
    const target = newGoalTarget.trim() ? { value: Number(newGoalTarget) } : null;
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: newGoalKind, label: kindDef.label, target_json: target }),
    });
    const d = await res.json();
    if (d.ok) { setGoalMsg("Goal added."); setNewGoalTarget(""); loadGoals(); }
    else setGoalMsg(d.error ?? "Error");
  }

  async function removeGoal(id: number) {
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    loadGoals();
  }

  const selectedKind = GOAL_KINDS.find((g) => g.kind === newGoalKind);

  return (
    <main className="mx-auto max-w-md space-y-6 pb-28 pt-5">
      <header className="px-4 animate-spring-in">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Settings</h1>
      </header>

      {/* Connections */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-1)" }}>
        <SectionLabel>Connections</SectionLabel>
        <SettingsCard>
          <Row>
            <div>
              <p className="text-[14px] text-ink">Oura Ring</p>
              <p className="text-[12px] text-ink-3">Sleep, readiness &amp; HRV</p>
            </div>
            {ouraConnected === true ? (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-[13px] text-accent">Connected</span>
              </div>
            ) : ouraConnected === false ? (
              <a
                href="/api/oura/connect"
                className="rounded-pill bg-accent px-5 py-2 text-[13px] font-semibold tracking-[-0.01em] text-bg min-h-[44px] flex items-center transition-transform active:scale-95"
              >
                Connect
              </a>
            ) : null}
          </Row>
          <Row noBorder>
            <div className="w-full space-y-3">
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Google Calendar .ics URL
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…"
                className="w-full rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink placeholder-ink-3 focus:border-accent focus:outline-none min-h-[44px]"
              />
              <div className="flex gap-2">
                <Button variant="primary" onClick={saveCal} className="flex-1">
                  Save
                </Button>
                <Button variant="secondary" onClick={syncCal} disabled={syncLoading} className="flex-1">
                  {syncLoading ? "Syncing…" : "Sync"}
                </Button>
              </div>
            </div>
          </Row>
        </SettingsCard>
        {ouraMsg && (
          <InlineMsg
            msg={ouraMsg}
            isError={ouraStatus === "error"}
          />
        )}
        {calMsg && <InlineMsg msg={calMsg} isError={calMsg.toLowerCase().includes("error")} />}
      </section>

      {/* Notifications */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-2)" }}>
        <SectionLabel>Notifications</SectionLabel>
        <SettingsCard>
          {notifStatus === "unsupported" ? (
            <Row noBorder>
              <p className="text-[14px] text-ink-2">Push notifications aren&apos;t supported in this browser.</p>
            </Row>
          ) : notifStatus === "needsInstall" ? (
            <Row noBorder>
              <p className="text-[14px] text-ink-2">
                Add Briefing to your Home Screen first — tap <span className="text-ink">Share</span> → <span className="text-ink">Add to Home Screen</span>,
                then open it from there to enable notifications.
              </p>
            </Row>
          ) : notifStatus === "granted" ? (
            <Row noBorder>
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] text-ink">Enabled</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-[13px] text-accent">Active</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={sendTestNotification} disabled={notifLoading} className="flex-1">
                    {notifLoading ? "Sending…" : "Send Test"}
                  </Button>
                  <Button variant="secondary" onClick={disableNotifications} disabled={notifLoading} className="flex-1">
                    {notifLoading ? "…" : "Disable"}
                  </Button>
                </div>
              </div>
            </Row>
          ) : notifStatus === "denied" ? (
            <Row noBorder>
              <p className="text-[14px] text-ink-2">Blocked — allow in iOS Settings → Safari → Notifications.</p>
            </Row>
          ) : (
            <Row noBorder>
              <div className="w-full space-y-3">
                <p className="text-[14px] text-ink-2">Morning briefings and evening reflection nudges.</p>
                <Button variant="primary" onClick={enableNotifications} disabled={notifLoading} className="w-full">
                  {notifLoading ? "Enabling…" : "Enable Notifications"}
                </Button>
              </div>
            </Row>
          )}
        </SettingsCard>
        {notifMsg && <InlineMsg msg={notifMsg} isError={notifMsg.toLowerCase().includes("fail")} />}
      </section>

      {/* Preferences */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-3)" }}>
        <SectionLabel>Preferences</SectionLabel>
        <SettingsCard>
          <Row noBorder>
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[14px] text-ink">Timezone</p>
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
              </select>
              <Button variant="primary" onClick={saveTimezone} disabled={tzSaving} className="w-full">
                {tzSaving ? "Saving…" : "Save Timezone"}
              </Button>
            </div>
          </Row>
        </SettingsCard>
        {tzMsg && <InlineMsg msg={tzMsg} isError={tzMsg.toLowerCase().includes("error")} />}
      </section>

      {/* Weather location */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-3)" }}>
        <SectionLabel>Weather Location</SectionLabel>
        <SettingsCard>
          <Row noBorder>
            <div className="w-full space-y-3">
              <p className="text-[13px] text-ink-2">
                Latitude/longitude for daily weather sync (overlays on sleep trends). Leave blank to disable.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="Latitude, e.g. 40.71"
                  className="w-1/2 rounded-control border border-line bg-bg px-4 py-3 font-mono text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="Longitude, e.g. -74.01"
                  className="w-1/2 rounded-control border border-line bg-bg px-4 py-3 font-mono text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
                />
              </div>
              <Button variant="primary" onClick={saveLocation} disabled={locSaving} className="w-full">
                {locSaving ? "Saving…" : "Save Location"}
              </Button>
            </div>
          </Row>
        </SettingsCard>
        {locMsg && <InlineMsg msg={locMsg} isError={locMsg.toLowerCase().includes("error")} />}
      </section>

      {/* Notifications — Wind-down */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-4)" }}>
        <SectionLabel>Wind-down Reminder</SectionLabel>
        <SettingsCard>
          <Row noBorder>
            <div className="w-full space-y-3">
              <p className="text-[13px] text-ink-2">Set a nightly wind-down time to receive a push nudge before bed.</p>
              <input
                type="time"
                value={windDownTime}
                onChange={(e) => setWindDownTime(e.target.value)}
                className="w-full rounded-control border border-line bg-bg px-4 py-3 font-mono text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
              />
              <Button variant="primary" onClick={saveWindDown} disabled={windDownSaving} className="w-full">
                {windDownSaving ? "Saving…" : "Save Wind-down Time"}
              </Button>
            </div>
          </Row>
        </SettingsCard>
        {windDownMsg && <InlineMsg msg={windDownMsg} isError={windDownMsg.toLowerCase().includes("error")} />}
      </section>

      {/* Goals */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-5)" }}>
        <SectionLabel>Goals</SectionLabel>
        <SettingsCard>
          {goals.map((g, i) => (
            <Row key={g.id} noBorder={i === goals.length - 1 && goals.length > 0}>
              <span className="text-[14px] text-ink">{g.label}</span>
              <button
                onClick={() => removeGoal(g.id)}
                className="text-[13px] font-medium text-ink-3 transition-colors hover:text-rose active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-end"
              >
                Remove
              </button>
            </Row>
          ))}
          <Row noBorder>
            <div className="w-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Add a goal</p>
              <select
                value={newGoalKind}
                onChange={(e) => setNewGoalKind(e.target.value)}
                className="w-full rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
              >
                {GOAL_KINDS.map((g) => <option key={g.kind} value={g.kind}>{g.label}</option>)}
              </select>
              {selectedKind?.placeholder && (
                <input
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder={selectedKind.placeholder}
                  type="number"
                  className="w-full rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
                />
              )}
              <Button variant="secondary" onClick={addGoal} className="w-full">
                Add Goal
              </Button>
            </div>
          </Row>
        </SettingsCard>
        {goalMsg && <InlineMsg msg={goalMsg} isError={goalMsg.toLowerCase().includes("error")} />}
      </section>

      {/* Data */}
      <section className="space-y-0 animate-spring-in" style={{ animationDelay: "var(--stagger-6)" }}>
        <SectionLabel>Data</SectionLabel>
        <SettingsCard>
          <Row>
            <a
              href="/api/export?format=json"
              download
              className="flex w-full min-h-[44px] items-center justify-between text-[14px] text-ink"
            >
              Export as JSON
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M2 7v5h10V7M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </Row>
          <Row noBorder>
            <a
              href="/api/export?format=csv"
              download
              className="flex w-full min-h-[44px] items-center justify-between text-[14px] text-ink"
            >
              Export as CSV
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M2 7v5h10V7M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </Row>
        </SettingsCard>
      </section>
    </main>
  );
}
