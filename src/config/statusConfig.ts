import type { InvoiceStatus } from '@/src/types';

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
    cls: 'bg-zinc-700/60 text-zinc-300',
    color: 'text-zinc-400',
    bg: 'bg-zinc-50 border-zinc-200',
    bar: 'bg-zinc-400',
  },
  sent: {
    label: 'Sent',
    cls: 'bg-blue-500/20 text-blue-300',
    color: 'text-blue-400',
    bg: 'bg-blue-50 border-blue-200',
    bar: 'bg-blue-500',
  },
  partial: {
    label: 'Deposit Rcvd',
    cls: 'bg-amber-500/20 text-amber-300',
    color: 'text-amber-400',
    bg: 'bg-amber-50 border-amber-200',
    bar: 'bg-amber-500',
  },
  paid: {
    label: 'Paid',
    cls: 'bg-emerald-500/20 text-emerald-300',
    color: 'text-emerald-400',
    bg: 'bg-green-50 border-green-200',
    bar: 'bg-green-500',
  },
  overdue: {
    label: 'Late',
    cls: 'bg-red-500/20 text-red-400',
    color: 'text-red-400',
    bg: 'bg-red-50 border-red-200',
    bar: 'bg-red-500',
  },
};
