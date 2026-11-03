export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationOptions {
  /** Give up after this many ms and resolve undefined (default 8000). */
  timeoutMs?: number;
}

/**
 * Best-effort current location (FR8). Resolves `{ lat, lng }` when permission
 * is granted, or `undefined` on denial, error, unavailability, or timeout.
 *
 * Never rejects and never blocks entry creation (R4): callers save with or
 * without location. No reverse-geocoding (out of scope).
 */
export function getCurrentLocation(
  options: LocationOptions = {},
): Promise<Coordinates | undefined> {
  const timeoutMs = options.timeoutMs ?? 8000;

  return new Promise((resolve) => {
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator) ||
      !navigator.geolocation
    ) {
      resolve(undefined);
      return;
    }

    let settled = false;
    const finish = (value: Coordinates | undefined) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(undefined), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        finish(undefined);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}
