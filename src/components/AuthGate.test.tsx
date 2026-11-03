import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { IndexedDbStore, setStore } from "@/lib/db";
import { AUTH_USERNAME, setSignedIn } from "@/lib/auth/session";
import { hashPassword, randomSaltHex } from "@/lib/auth/credentials";
import { AuthGate } from "./AuthGate";

let n = 0;
async function freshStoreWithSeed() {
  n += 1;
  const store = new IndexedDbStore(`authgate-test-${n}`);
  setStore(store);
  const salt = randomSaltHex();
  const passwordHash = await hashPassword("Initial1", salt);
  // Pre-seed directly so the gate's own seeding is idempotent against it.
  await store.putAuth({
    username: AUTH_USERNAME,
    salt,
    passwordHash,
    mustChange: true,
  });
  return store;
}

// jsdom's localStorage is unreliable in this runner (see --localstorage-file
// warning); install a deterministic in-memory stub so session state round-trips.
function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const mem: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: mem,
  });
}

describe("AuthGate (FR16-FR20)", () => {
  beforeEach(async () => {
    installMemoryLocalStorage();
    setSignedIn(false);
    await freshStoreWithSeed();
  });
  afterEach(() => setSignedIn(false));

  it("shows the login screen when not signed in (gates children)", async () => {
    render(
      <AuthGate>
        <div>SECRET APP CONTENT</div>
      </AuthGate>,
    );
    expect(
      await screen.findByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("SECRET APP CONTENT")).not.toBeInTheDocument();
  });

  it("does not offer a signup option (FR17)", async () => {
    render(
      <AuthGate>
        <div>APP</div>
      </AuthGate>,
    );
    await screen.findByRole("button", { name: /sign in/i });
    expect(screen.queryByText(/sign up|create account|register/i)).toBeNull();
  });

  it("rejects a wrong password", async () => {
    const user = userEvent.setup();
    render(
      <AuthGate>
        <div>APP</div>
      </AuthGate>,
    );
    await user.type(await screen.findByLabelText(/email/i), AUTH_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect/i);
  });

  it("forces a password change on first login, then reveals the app (FR19)", async () => {
    const user = userEvent.setup();
    render(
      <AuthGate>
        <div>SECRET APP CONTENT</div>
      </AuthGate>,
    );
    await user.type(await screen.findByLabelText(/email/i), AUTH_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), "Initial1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Forced-change stage.
    await user.type(
      await screen.findByLabelText("New password", { exact: true }),
      "BrandNew99",
    );
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "BrandNew99",
    );
    await user.click(screen.getByRole("button", { name: /save & continue/i }));

    expect(await screen.findByText("SECRET APP CONTENT")).toBeInTheDocument();
  });

  it("renders children immediately when already signed in", async () => {
    setSignedIn(true);
    render(
      <AuthGate>
        <div>SECRET APP CONTENT</div>
      </AuthGate>,
    );
    expect(await screen.findByText("SECRET APP CONTENT")).toBeInTheDocument();
  });
});
