const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a "YYYY-MM-DD" date string as "DD/Mon/YYYY" (e.g. 30/Apr/2026). Timezone-safe. */
export function fmtDate(s: string | undefined | null): string {
  if (!s) return '—';
  const clean = s.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return s;
  return `${String(d).padStart(2, '0')}/${MONTHS[m - 1]}/${y}`;
}

export function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function fmtShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return fmtUSD(n);
}
