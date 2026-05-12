/**
 * Centralised cache/storage management.
 * NEVER call localStorage.clear() or sessionStorage.clear() — Firebase auth
 * keys must not be touched. Only remove known ei24_ prefixed keys.
 */

const SESSION_KEYS = ['ei24_invoices', 'ei24_clients', 'ei24_projects'];

const SESSION_DATE_KEY = 'ei24_session_date';

export function clearSessionCache() {
  SESSION_KEYS.forEach((k) => {
    sessionStorage.removeItem(k);
    sessionStorage.removeItem(`${k}_ts`);
  });
}

export function clearAllCache() {
  clearSessionCache();
}

export function checkDailyReset(): boolean {
  if (typeof window === 'undefined') return false;
  const today = new Date().toDateString();
  const last = localStorage.getItem(SESSION_DATE_KEY);
  let reset = false;
  if (last && last !== today) {
    clearSessionCache();
    reset = true;
  }
  localStorage.setItem(SESSION_DATE_KEY, today);
  return reset;
}
