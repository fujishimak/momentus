/**
 * Client-side password hashing (FR18, NFR8). Uses Web Crypto PBKDF2-SHA256.
 *
 * SECURITY NOTE: this runs entirely in the browser on a static export. It is a
 * demonstration/observation gate, NOT a security boundary (requirements §9/R6):
 * local data is readable and client code is inspectable. Passwords are never
 * stored in plaintext — only a salted PBKDF2 hash.
 */

const ITERATIONS = 150_000;
const KEY_BITS = 256;

function getCrypto(): Crypto {
  // Browser: globalThis.crypto; Node (tests): webcrypto exposed as globalThis.crypto in 20+.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto is not available in this environment.");
  }
  return c;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Decode a hex string into a plain ArrayBuffer (a valid BufferSource). */
function hexToBuffer(hex: string): ArrayBuffer {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out.buffer;
}

/** Encode a string into a plain ArrayBuffer. */
function utf8Buffer(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const out = new Uint8Array(encoded.length);
  out.set(encoded);
  return out.buffer;
}

/** Generate a random 16-byte salt as hex. */
export function randomSaltHex(): string {
  const salt = getCrypto().getRandomValues(new Uint8Array(16));
  return bytesToHex(salt);
}

/** Derive the PBKDF2-SHA256 hash (hex) of a password with the given hex salt. */
export async function hashPassword(
  password: string,
  saltHex: string,
): Promise<string> {
  const crypto = getCrypto();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    utf8Buffer(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuffer(saltHex),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Constant-time-ish comparison of two equal-length hex strings. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify a password against a stored salt + hash (FR18). */
export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string,
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  return constantTimeEqual(actual, expectedHashHex);
}
