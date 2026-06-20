"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Incorrect password.");
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true);
    setError("");
    try {
      const optRes = await fetch("/api/auth/webauthn/login/options");
      if (!optRes.ok) { setError("No passkeys registered."); return; }
      const options = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (verRes.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const d = await verRes.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Passkey login failed.");
      }
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "NotAllowedError") {
        setError("Passkey error: " + String(e));
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handleRegisterPasskey() {
    setRegisterLoading(true);
    setError("");
    try {
      const optRes = await fetch("/api/auth/webauthn/register/options");
      if (!optRes.ok) { setError("Failed to get registration options."); return; }
      const options = await optRes.json();
      const attResp = await startRegistration({ optionsJSON: options });
      const verRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });
      if (verRes.ok) {
        setShowRegister(false);
        setError("");
        router.push("/dashboard");
        router.refresh();
      } else {
        const d = await verRes.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Registration failed.");
      }
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "NotAllowedError") {
        setError("Registration error: " + String(e));
      }
    } finally {
      setRegisterLoading(false);
    }
  }

  const hasWebAuthn = typeof window !== "undefined" && "PublicKeyCredential" in window;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-3">Your daily recovery briefing.</p>
        </div>

        {hasWebAuthn && (
          <div className="space-y-3">
            <button
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="w-full rounded-control border border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink transition-all duration-200 active:scale-[0.98] disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
            >
              {passkeyLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
              ) : (
                <span>🔑</span>
              )}
              Sign in with Face ID / Passkey
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-3">or</span>
              <div className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus={!hasWebAuthn}
            className="w-full rounded-control border border-line bg-surface px-4 py-3.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg min-h-[44px]"
          />
          {error && <p className="text-sm text-rose">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-control bg-accent px-4 py-3.5 text-sm font-medium text-bg disabled:opacity-50 min-h-[44px] transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? "Checking…" : "Log in"}
          </button>
        </form>

        {hasWebAuthn && (
          <div className="pt-2 border-t border-line">
            {!showRegister ? (
              <button
                onClick={() => setShowRegister(true)}
                className="w-full text-center text-xs text-ink-3 underline-offset-2 hover:text-ink active:scale-95"
              >
                Set up Face ID / Passkey
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-ink-2">Sign in with your password first, then register a passkey for next time.</p>
                <button
                  onClick={handleRegisterPasskey}
                  disabled={registerLoading}
                  className="w-full rounded-control border border-accent/40 bg-accent/5 px-4 py-3 text-sm font-medium text-accent disabled:opacity-50 min-h-[44px] transition-all duration-200 active:scale-[0.98]"
                >
                  {registerLoading ? "Registering…" : "Register Passkey"}
                </button>
                <button
                  onClick={() => setShowRegister(false)}
                  className="w-full text-center text-xs text-ink-3 active:scale-95"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
