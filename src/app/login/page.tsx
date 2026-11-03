"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { changeOwnPassword } from "./actions";

const MIN = 8;

function LoginInner() {
  const router = useRouter();
  const [stage, setStage] = useState<"login" | "change">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setError("You're offline — connect to sign in.");
      return;
    }
    setBusy(true);
    setError(null);
    // Don't auto-redirect; we may need the forced-change step first.
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (!res || res.error) {
      setError("Incorrect email or password.");
      return;
    }
    // Check whether a forced change is required (session carries mustChange).
    const session = await fetch("/api/auth/session").then((r) => r.json());
    if (session?.user?.mustChange) {
      setStage("change");
      return;
    }
    router.replace("/");
  }

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPassword.length < MIN) {
      setError(`New password must be at least ${MIN} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await changeOwnPassword(newPassword);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not change your password.");
      return;
    }
    // Re-authenticate with the new password to refresh the JWT (clears mustChange).
    const res = await signIn("credentials", {
      email,
      password: newPassword,
      redirect: false,
    });
    if (!res || res.error) {
      setStage("login");
      setPassword("");
      setError("Password changed — please sign in with your new password.");
      return;
    }
    router.replace("/");
  }

  return (
    <section className="login" aria-labelledby="login-heading">
      <div className="login__card">
        <h1 id="login-heading" className="login__title">
          Momentus
        </h1>

        {stage === "login" ? (
          <form onSubmit={handleLogin}>
            <label className="login__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className="login__input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="login__label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="login__input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="login__submit" disabled={busy}>
              {busy ? "Signing in…" : offline ? "Offline" : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleChange}>
            <p className="login__hint">
              Set a new password to finish signing in.
            </p>
            <label className="login__label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              className="login__input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <label className="login__label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="login__input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="login__submit" disabled={busy}>
              {busy ? "Saving…" : "Save & Continue"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="screen__placeholder">Loading…</p>}>
      <LoginInner />
    </Suspense>
  );
}
