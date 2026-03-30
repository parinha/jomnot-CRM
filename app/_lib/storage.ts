// ── Storage adapter ───────────────────────────────────────────────────────────
// All localStorage access goes through here.
// To migrate to Firebase: replace the body of each function with Firestore calls
// (and make them async — that will require updating callers too).

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function storageGet<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function storageSet<T>(key: string, value: T): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function storageRemove(key: string): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(key)
  } catch {}
}
