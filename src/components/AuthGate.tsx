"use client";

import { useEffect, useState } from "react";
import { getStore } from "@/lib/db";
import { ensureSeeded, isSignedIn, setSignedIn } from "@/lib/auth/session";
import { INITIAL_CREDENTIAL } from "@/lib/auth/initial-credential";
import { LoginForm } from "./LoginForm";

/**
 * Gates the whole app behind the client-side login (design §3.7, FR16/FR20).
 * Seeds the initial credential on first run, then renders either the Login
 * screen or the app children based on the local session flag. NOT a security
 * boundary (NFR8 / requirements §9).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedInState] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureSeeded(getStore(), INITIAL_CREDENTIAL);
      if (!active) return;
      setSignedInState(isSignedIn());
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  function handleSignedIn() {
    setSignedIn(true);
    setSignedInState(true);
  }

  if (!ready) {
    return <p className="screen__placeholder">Loading…</p>;
  }

  if (!signedIn) {
    return <LoginForm onSignedIn={handleSignedIn} />;
  }

  return <>{children}</>;
}

/** Sign out (FR20): clear the session and reload to the Login screen. */
export function signOut(): void {
  setSignedIn(false);
  if (typeof window !== "undefined") window.location.reload();
}
