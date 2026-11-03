import type {
  AppPreferences,
  Client,
  CompanyProfile,
  Invoice,
  LineItem,
  Quotation,
  QuotationStatus,
  QuoteTaxMode,
} from '@/src/types';
import { uid } from '@/src/lib/id';

export interface QuoteTotals {
  subtotal: number;
  optionalTotal: number;
  discount: number;
  afterDiscount: number;
  tax: number;
  total: number;
  deposit: number | null;
}

type CalcInput = Pick<
  Quotation,
  'items' | 'discountPercent' | 'taxMode' | 'taxRate' | 'depositMode' | 'depositValue'
>;

/**
 * Quote math:
 * subtotal (non-optional items) → minus discount → VAT added on top / WHT deducted → total.
 * Deposit is a % of the total or a fixed amount capped at the total.
 */
export function calcQuote(q: CalcInput): QuoteTotals {
  const line = (it: { qty: number; unitPrice: number }) => it.qty * it.unitPrice;
  const subtotal = q.items.filter((it) => !it.optional).reduce((s, it) => s + line(it), 0);
  const optionalTotal = q.items.filter((it) => it.optional).reduce((s, it) => s + line(it), 0);
  const discountPct = Math.min(100, Math.max(0, q.discountPercent ?? 0));
  const discount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discount;
  const rate = q.taxMode === 'none' ? 0 : Math.max(0, q.taxRate ?? 0);
  const tax = afterDiscount * (rate / 100);
  const total = q.taxMode === 'vat' ? afterDiscount + tax : afterDiscount - tax;

  let deposit: number | null = null;
  if (q.depositMode && q.depositValue != null && q.depositValue > 0) {
    deposit =
      q.depositMode === 'percent'
        ? total * (Math.min(100, q.depositValue) / 100)
        : Math.min(total, q.depositValue);
  }

  return { subtotal, optionalTotal, discount, afterDiscount, tax, total, deposit };
}

export function localToday(): string {
  const d = new Date();
  return toIsoDate(d);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" + days → "YYYY-MM-DD" (timezone-safe). */
export function validUntil(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date;
  return toIsoDate(new Date(y, m - 1, d + (days || 0)));
}

/** Draft/sent quotes past their valid-until date read as expired. */
export function effectiveQuoteStatus(q: Quotation, today = localToday()): QuotationStatus {
  const status = q.status ?? 'draft';
  if ((status === 'draft' || status === 'sent') && validUntil(q.date, q.validDays) < today) {
    return 'expired';
  }
  return status;
}

export function nextQuotationNumber(quotes: Quotation[]): string {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const max = quotes.reduce((m, q) => {
    if (!q.number.startsWith(prefix)) return m;
    const n = parseInt(q.number.slice(prefix.length), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Replaces {contact}, {client}, {project}, {company} in intro text. */
export function fillPlaceholders(
  text: string,
  ctx: { client: Client | null; company: CompanyProfile; projectName?: string }
): string {
  const contact = ctx.client?.contactPerson || ctx.client?.name || 'Sir/Madam';
  return text
    .replace(/\{contact\}/g, contact)
    .replace(/\{client\}/g, ctx.client?.name ?? '')
    .replace(/\{project\}/g, ctx.projectName || 'project')
    .replace(/\{company\}/g, ctx.company.name || 'us');
}

export function splitLines(text: string | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Default tax mode for a new quote, taken from the workspace tax settings. */
export function defaultTaxFromPrefs(
  prefs: Pick<AppPreferences, 'taxEnabled' | 'taxLabel' | 'taxRate' | 'taxType'>
): { taxMode: QuoteTaxMode; taxLabel?: string; taxRate?: number } {
  if (!prefs.taxEnabled) return { taxMode: 'none' };
  return {
    taxMode: prefs.taxType === 'deductive' ? 'wht' : 'vat',
    taxLabel: prefs.taxLabel,
    taxRate: prefs.taxRate,
  };
}

export function taxLabelFor(q: Pick<Quotation, 'taxMode' | 'taxLabel'>): string {
  return q.taxLabel?.trim() || (q.taxMode === 'vat' ? 'VAT' : 'WHT');
}

/**
 * Builds a draft invoice from an accepted quotation.
 * - Optional add-ons are left out.
 * - A discount becomes a negative line item so the invoice total matches.
 * - VAT/WHT carries over only when it matches the workspace tax setting (invoices use that rate).
 * - A fixed deposit amount becomes the nearest whole percentage.
 */
export function quoteToInvoice(
  q: Quotation,
  opts: {
    id: string;
    number: string;
    date: string;
    tax: { enabled: boolean; type: 'additive' | 'deductive'; rate: number; label: string };
  }
): { invoice: Invoice; warnings: string[] } {
  const warnings: string[] = [];
  const t = calcQuote(q);

  const items: LineItem[] = q.items
    .filter((it) => !it.optional)
    .map((it) => ({
      id: uid(),
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
    }));
  if (t.discount > 0) {
    items.push({
      id: uid(),
      description: `Discount (${q.discountPercent}%)`,
      qty: 1,
      unitPrice: -Math.round(t.discount * 100) / 100,
    });
  }

  let withWHT: boolean | undefined;
  if (q.taxMode !== 'none') {
    const wanted = q.taxMode === 'wht' ? 'deductive' : 'additive';
    if (opts.tax.enabled && opts.tax.type === wanted) {
      withWHT = true;
      if ((q.taxRate ?? 0) !== opts.tax.rate) {
        warnings.push(
          `Invoice uses your workspace ${opts.tax.label} rate (${opts.tax.rate}%), not the quote's ${q.taxRate ?? 0}%.`
        );
      }
    } else {
      warnings.push(
        `${taxLabelFor(q)} was not added: invoices use the tax set in Settings → Invoicing.`
      );
    }
  }

  let depositPercent: number | undefined;
  if (t.deposit != null && t.total > 0) {
    depositPercent =
      q.depositMode === 'percent'
        ? q.depositValue
        : Math.min(99, Math.max(1, Math.round((t.deposit / t.total) * 100)));
    if (q.depositMode === 'amount') {
      warnings.push(`Fixed deposit converted to ${depositPercent}% (invoices use percentages).`);
    }
  }

  const invoice: Invoice = {
    id: opts.id,
    number: opts.number,
    date: opts.date,
    paymentTerms: 'Due on receipt',
    status: 'draft',
    clientId: q.clientId,
    projectName: q.projectName,
    items,
    notes: q.notes ? `${q.notes}\n\nRef. quotation ${q.number}` : `Ref. quotation ${q.number}`,
    depositPercent,
    withWHT,
    showVatTin: q.showVatTin,
    paymentMethodId: q.paymentMethodId,
    createdAt: new Date().toISOString(),
  };
  return { invoice, warnings };
}
