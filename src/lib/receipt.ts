import type { Invoice, Receipt, ReceiptKind } from '@/src/types';
import { WHT_RATE } from '@/src/lib/calculations';

export const RECEIPT_METHODS = ['ABA KHQR', 'Bank transfer', 'Cash', 'Card', 'Cheque'] as const;

export const DEFAULT_RECEIPT_MESSAGE =
  'Thank you for your payment. This receipt confirms the amount received for the invoice referenced above. Please keep it for your records.';

export const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = {
  full: 'Payment in full',
  deposit: 'Deposit payment',
  balance: 'Final payment',
};

export const r2 = (n: number) => Math.round(n * 100) / 100;

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number | null;
  net: number;
  deposit: number | null;
}

/** Same math as the invoice PDF sheet, so receipt totals match the invoice the client has. */
export function invoiceTotals(
  inv: Invoice,
  tax: { taxRate?: number; taxType?: 'additive' | 'deductive' }
): InvoiceTotals {
  const rate = tax.taxRate ?? WHT_RATE * 100;
  const subtotal = inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const taxAmount = inv.withWHT ? subtotal * (rate / 100) : null;
  const net = inv.withWHT && tax.taxType !== 'additive' ? subtotal * (1 - rate / 100) : subtotal;
  const deposit = inv.depositPercent != null ? net * (inv.depositPercent / 100) : null;
  return { subtotal, taxAmount, net: r2(net), deposit: deposit == null ? null : r2(deposit) };
}

export function nextReceiptNumber(receipts: Pick<Receipt, 'number'>[]): string {
  const year = new Date().getFullYear();
  const prefix = `RCT-${year}-`;
  const max = receipts.reduce((m, r) => {
    if (!r.number.startsWith(prefix)) return m;
    const n = parseInt(r.number.slice(prefix.length), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Amount for a receipt kind, given what has already been paid on the invoice. */
export function amountForKind(kind: ReceiptKind, totals: InvoiceTotals, paid: number): number {
  const remaining = Math.max(0, r2(totals.net - paid));
  if (kind === 'deposit') return Math.min(remaining, totals.deposit ?? r2(remaining / 2));
  return remaining;
}

/** Best first guess for a new receipt on this invoice. */
export function suggestKind(inv: Invoice, totals: InvoiceTotals, paid: number): ReceiptKind {
  if (paid > 0) return 'balance';
  if (totals.deposit != null && inv.status !== 'paid') return 'deposit';
  return 'full';
}

// ── Amount in words ───────────────────────────────────────────────────────────

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function words999(n: number): string {
  let s = '';
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + ' hundred';
    n %= 100;
    if (n) s += ' ';
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)];
    if (n % 10) s += '-' + ONES[n % 10];
  } else if (n) s += ONES[n];
  return s;
}

const CURRENCY_WORDS: Record<string, [string, boolean]> = {
  // [name, has cents]
  USD: ['US dollars', true],
  KHR: ['riels', false],
  THB: ['baht', true],
  EUR: ['euros', true],
  GBP: ['pounds sterling', true],
  SGD: ['Singapore dollars', true],
  VND: ['dong', false],
};

/** e.g. 1266.08 → "One thousand two hundred sixty-six US dollars and 08/100" */
export function amountInWords(amount: number, currencyCode = 'USD'): string {
  const [name, hasCents] = CURRENCY_WORDS[currencyCode] ?? [currencyCode, true];
  const abs = Math.abs(r2(amount));
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  const parts: string[] = [];
  let n = whole;
  for (const [v, w] of [
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ] as const) {
    if (n >= v) {
      parts.push(words999(Math.floor(n / v)) + ' ' + w);
      n %= v;
    }
  }
  if (n || parts.length === 0) parts.push(words999(n) || 'zero');
  const s = parts.join(' ');
  const text = s.charAt(0).toUpperCase() + s.slice(1) + ' ' + name;
  return hasCents ? `${text} and ${String(cents).padStart(2, '0')}/100` : text;
}
