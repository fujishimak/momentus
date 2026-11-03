import type { MomentusStore } from "./types";
import { IndexedDbStore } from "./indexeddb-store";

export * from "./types";
export { IndexedDbStore } from "./indexeddb-store";

let instance: MomentusStore | undefined;

/**
 * Returns the process-wide store. Today this is always the IndexedDB backend;
 * the iOS/Capacitor build will swap in a Capacitor SQLite backend here (T9.2)
 * without any change to feature code (design §6, R3).
 */
export function getStore(): MomentusStore {
  if (!instance) {
    instance = new IndexedDbStore();
  }
  return instance;
}

/** Test seam: override the store (e.g. with a fake or a fresh db). */
export function setStore(store: MomentusStore): void {
  instance = store;
}
