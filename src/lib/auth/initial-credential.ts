import type { AuthRecord } from "@/lib/db";
import { AUTH_USERNAME } from "./session";

/**
 * The seed credential for first run (FR17/FR18).
 *
 * Only the random salt and the PBKDF2-SHA256 hash of the generated 8-character
 * alphanumeric initial password are stored here. The PLAINTEXT IS NOT PRESENT
 * in the repo — it was generated once and delivered to the user out-of-band.
 * The user is forced to change it on first login (FR19), after which this seed
 * is irrelevant (the stored record is overwritten).
 *
 * Even if an observer reads this file, the salted hash is not reversible to the
 * password (and the gate is explicitly not a security boundary — NFR8/§9).
 */
export const INITIAL_CREDENTIAL: AuthRecord = {
  username: AUTH_USERNAME,
  salt: "71c8e9ee3bc0512b1a9970c87e9a3c57",
  passwordHash:
    "7628849ccfe714cf0c4a32ec7a6e78b6386a7a76d3e6149e3866587126b97adf",
  mustChange: true,
};
