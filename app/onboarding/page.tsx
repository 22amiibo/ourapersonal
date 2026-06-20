"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "oura" | "timezone" | "notifications" | "done";

const STEP_ORDER: Step[] = ["welcome", "oura", "timezone", "notifications", "done"];

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

function DotProgress({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={`rounded-full transition-all duration-300 ${
            i === idx
              ? "h-2 w-6 bg-accent"
              : i < idx
              ? "h-2 w-2 bg-accent/40"
              : "h-2 w-2 bg-line-strong"
          }`}
        />
      ))}
    </div>
  );
}

function CheckCircle() {
  return (
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12l4.5 4.5 9.5-9" stroke="var(--color-accent)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
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
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {step !== "welcome" && step !== "done" && <DotProgress step={step} />}

        {/* Step content re-mounts on change to trigger spring-in animation */}
        <div key={step} className="animate-spring-in">

          {step === "welcome" && (
            <div className="space-y-7">
              <div className="space-y-4">
                <h1 className="text-[34px] font-semibold tracking-tight text-ink leading-tight">
                  Your personal<br />intelligence<br />platform.
                </h1>
                <ul className="space-y-3">
                  {[
                    "Sync Oura sleep & readiness",
                    "Log caffeine, alcohol & mood",
                    "AI-written morning briefings",
                    "Discover what affects your performance",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] text-ink-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
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
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">Connect Oura</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Sync your sleep score, readiness, and HRV automatically each morning.</p>
              </div>
              <a
                href="/api/oura/connect"
                className="flex w-full items-center justify-center rounded-control bg-accent px-4 py-3.5 text-center font-medium text-bg min-h-[44px] transition-all duration-200 active:scale-[0.98]"
              >
                Connect Oura Ring
              </a>
              <button
                onClick={() => setStep("timezone")}
                className="w-full text-center text-[14px] text-ink-3 underline-offset-2 hover:text-ink active:scale-95 min-h-[44px]"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === "timezone" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">Your timezone</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Used to compute your day, greetings, and weekly rollups.</p>
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-control border border-line bg-bg px-4 py-3 text-[14px] text-ink focus:border-accent focus:outline-none min-h-[44px]"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
              </select>
              <button
                onClick={saveTimezone}
                className="w-full rounded-control bg-accent px-4 py-3.5 font-medium text-bg min-h-[44px] transition-all duration-200 active:scale-[0.98]"
              >
                {tzSaved ? "Saved" : "Save timezone"}
              </button>
            </div>
          )}

          {step === "notifications" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">Notifications</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Get a push when your morning briefing is ready and a nudge to reflect each evening. Requires this app installed to your home screen.</p>
              </div>
              {notifStatus === "granted" ? (
                <div className="rounded-control border border-accent/30 bg-accent/5 p-4 text-[14px] text-accent">
                  Notifications enabled.
                </div>
              ) : notifStatus === "denied" ? (
                <div className="rounded-control border border-line bg-bg p-4 text-[14px] text-ink-2">
                  Blocked — allow in iOS Settings → Safari → Notifications.
                </div>
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
                className="w-full text-center text-[14px] text-ink-3 underline-offset-2 hover:text-ink active:scale-95 min-h-[44px]"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-5 text-center">
              <CheckCircle />
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight text-ink">You&apos;re all set.</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Your dashboard is ready. Start by logging today&apos;s intake or writing your first reflection.</p>
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
      </div>
    </main>
  );
}
