/**
 * storage.ts — Typed localStorage helpers.
 *
 * Wraps the get/set/remove dance with JSON.parse + try/catch so consumers
 * get a typed value or `null` and never have to think about quota or invalid
 * payloads. Use this for any per-admin state that should survive a reload
 * (preferences, recently viewed, filter presets).
 */
export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — silent */
  }
}

export function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* silent */
  }
}
