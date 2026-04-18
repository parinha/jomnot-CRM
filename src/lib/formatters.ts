import type { AppPreferences } from '@/src/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a "YYYY-MM-DD" date string. Respects the format preference. Timezone-safe. */
export function fmtDate(
  s: string | undefined | null,
  format: AppPreferences['dateFormat'] = 'DD/Mon/YYYY'
): string {
  if (!s) return '—';
  const clean = s.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return s;
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const mon = MONTHS[m - 1];
  switch (format) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${y}`;
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${y}`;
    case 'YYYY-MM-DD':
      return `${y}-${mm}-${dd}`;
    default:
      return `${dd}/${mon}/${y}`;
  }
}

export function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Format a number as currency using the given ISO 4217 code. Falls back to USD. */
export function fmtCurrency(n: number, currencyCode = 'USD'): string {
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency: currencyCode });
  } catch {
    return fmtUSD(n);
  }
}

/** Short currency format (e.g. $1.2k, $3.4M). Uses the provided symbol for the prefix. */
export function fmtShortCurrency(n: number, currencyCode = 'USD', currencySymbol = '$'): string {
  if (n >= 1_000_000) return `${currencySymbol}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currencySymbol}${(n / 1_000).toFixed(1)}k`;
  return fmtCurrency(n, currencyCode);
}

export function fmtShort(n: number): string {
  return fmtShortCurrency(n);
}
