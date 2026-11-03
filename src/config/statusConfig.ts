import type { InvoiceStatus, QuotationStatus } from '@/src/types';

// ── Invoice status ─────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    cls: string; // badge bg + text (used in table/dropdown)
    color: string; // text-only class (used in reports)
    bg: string; // bg + border classes (used in reports cards)
    bar: string; // bar fill class (used in reports chart)
  }
> = {
  draft: {
    label: 'Draft',
    cls: 'bg-slate-100 text-slate-600',
    color: 'text-slate-500',
    bg: 'bg-zinc-50 border-zinc-200',
    bar: 'bg-zinc-400',
  },
  sent: {
    label: 'Sent',
    cls: 'bg-blue-50 text-blue-700',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    bar: 'bg-blue-500',
  },
  partial: {
    label: 'Deposit Rcvd',
    cls: 'bg-amber-50 text-amber-700',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    bar: 'bg-amber-500',
  },
  paid: {
    label: 'Paid',
    cls: 'bg-brand-soft text-brand-ink',
    color: 'text-brand',
    bg: 'bg-green-50 border-green-200',
    bar: 'bg-brand',
  },
  overdue: {
    label: 'Late',
    cls: 'bg-red-50 text-red-600',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    bar: 'bg-red-500',
  },
};

// ── Quotation status ───────────────────────────────────────────────────────────
export const QUOTE_STATUS_CONFIG: Record<QuotationStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  sent: { label: 'Sent', cls: 'bg-blue-50 text-blue-700' },
  accepted: { label: 'Accepted', cls: 'bg-brand-soft text-brand-ink' },
  declined: { label: 'Declined', cls: 'bg-red-50 text-red-600' },
  expired: { label: 'Expired', cls: 'bg-amber-50 text-amber-700' },
};
