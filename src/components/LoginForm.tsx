"use client";

import { useState } from "react";
import { getStore } from "@/lib/db";
import { authenticate, changePassword } from "@/lib/auth/session";

export interface LoginFormProps {
  /** Called once the user is fully signed in (and any forced change done). */
  onSignedIn: () => void;
}

type Stage = "login" | "change";

const MIN_PASSWORD = 8;

/**
 * Login screen (design §3.7, FR16-FR19). Email + password, no signup. On first
 * login with the initial password, switches to a forced "set a new password"
 * stage before completing sign-in.
 */
export function LoginForm({ onSignedIn }: LoginFormProps) {
  const [stage, setStage] = useState<Stage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authenticate(getStore(), email.trim(), password);
      if (!result.ok) {
        setError("Incorrect email or password.");
        return;
      }
      if (result.mustChange) {
        setStage("change");
        return;
      }
      onSignedIn();
    } finally {
      setBusy(false);
    }
  }

  async function handleChange() {
    if (busy) return;
    if (newPassword.length < MIN_PASSWORD) {
      setError(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(getStore(), email.trim(), newPassword);
      onSignedIn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login" aria-labelledby="login-heading">
      <div className="login__card">
        <h1 id="login-heading" className="login__title">
          Momentus
        </h1>

        {stage === "login" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
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
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleChange();
            }}
          >
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
