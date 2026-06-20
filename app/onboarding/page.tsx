"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "oura" | "timezone" | "notifications" | "done";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney",
];

function urlB64ToArrayBuffer(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0))).buffer;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [timezone, setTimezone] = useState("America/New_York");
  const [tzSaved, setTzSaved] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const [notifLoading, setNotifLoading] = useState(false);

  async function saveTimezone() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    setTzSaved(true);
    setTimeout(() => setStep("notifications"), 800);
  }

  async function enableNotifications() {
    if (!("Notification" in window)) { setNotifStatus("unsupported"); return; }
    setNotifLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setNotifStatus("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-key");
      if (keyRes.ok) {
        const { publicKey } = await keyRes.json();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToArrayBuffer(publicKey) });
        await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      }
      setNotifStatus("granted");
    } catch {
      setNotifStatus("denied");
    } finally {
      setNotifLoading(false);
      setTimeout(() => setStep("done"), 800);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 gap-8">
      <div className="w-full max-w-sm space-y-6">

        {step === "welcome" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">Welcome to Briefing</h1>
              <p className="mt-2 text-sm text-ink-2">Your personal health and performance intelligence dashboard. Let's get you set up in a minute.</p>
            </div>
            <ul className="space-y-3 text-sm text-ink-2">
              <li className="flex gap-3"><span className="text-accent">•</span> Sync Oura sleep & readiness</li>
              <li className="flex gap-3"><span className="text-accent">•</span> Log caffeine, alcohol, meals & mood</li>
              <li className="flex gap-3"><span className="text-accent">•</span> AI-written morning briefings</li>
              <li className="flex gap-3"><span className="text-accent">•</span> Discover what affects your performance</li>
            </ul>
            <button
              onClick={() => setStep("oura")}
              className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg min-h-[44px] transition-all duration-200 active:scale-[0.98]"
            >
              Get started
            </button>
          </div>
        )}

        {step === "oura" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-1">Step 1 of 3</p>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Connect Oura</h2>
              <p className="mt-1 text-sm text-ink-2">Sync your sleep score, readiness, and HRV automatically each morning.</p>
            </div>
            <a
              href="/api/oura/connect"
              className="block rounded-control bg-accent px-4 py-3.5 text-center font-medium text-bg min-h-[44px] transition-all duration-200 active:scale-[0.98]"
            >
              Connect Oura Ring
            </a>
            <button
              onClick={() => setStep("timezone")}
              className="w-full text-center text-sm text-ink-3 underline-offset-2 hover:text-ink active:scale-95"
            >
              Skip for now →
            </button>
          </div>
        )}

        {step === "timezone" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-1">Step 2 of 3</p>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Your timezone</h2>
              <p className="mt-1 text-sm text-ink-2">Used to compute your day, greetings, and weekly rollups.</p>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-control border border-line bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
            </select>
            <button
              onClick={saveTimezone}
              className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg min-h-[44px] transition-all duration-200 active:scale-[0.98]"
            >
              {tzSaved ? "Saved ✓" : "Save timezone"}
            </button>
          </div>
        )}

        {step === "notifications" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-3 mb-1">Step 3 of 3</p>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Notifications</h2>
              <p className="mt-1 text-sm text-ink-2">Get a push when your morning briefing is ready and a nudge to reflect each evening. Requires this app installed to your home screen.</p>
            </div>
            {notifStatus === "granted" ? (
              <div className="rounded-control border border-accent/30 bg-accent/5 p-4 text-sm text-accent">Notifications enabled ✓</div>
            ) : notifStatus === "denied" ? (
              <div className="rounded-control border border-line bg-bg p-4 text-sm text-ink-2">Blocked — allow in iOS Settings → Safari → Notifications.</div>
            ) : (
              <button
                onClick={enableNotifications}
                disabled={notifLoading}
                className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg min-h-[44px] disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
              >
                {notifLoading ? "Enabling…" : "Enable notifications"}
              </button>
            )}
            <button
              onClick={() => setStep("done")}
              className="w-full text-center text-sm text-ink-3 underline-offset-2 hover:text-ink active:scale-95"
            >
              Skip for now →
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-5 text-center">
            <div className="text-6xl">🎉</div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">You're all set!</h2>
              <p className="mt-1 text-sm text-ink-2">Your dashboard is ready. Start by logging today's intake or writing your first reflection.</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg min-h-[44px] transition-all duration-200 active:scale-[0.98]"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
