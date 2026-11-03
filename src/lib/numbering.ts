import type { Invoice } from '@/src/types';

export function nextInvoiceNumber(invoices: Pick<Invoice, 'number'>[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const max = invoices.reduce((m, inv) => {
    if (!inv.number.startsWith(prefix)) return m;
    const n = parseInt(inv.number.slice(prefix.length), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
