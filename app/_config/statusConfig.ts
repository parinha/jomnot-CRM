import type { InvoiceStatus, ProjectStatus, ProjectItemStatus } from '@/app/dashboard/AppStore';

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
    cls: 'bg-zinc-100 text-zinc-600',
    color: 'text-zinc-600',
    bg: 'bg-zinc-50 border-zinc-200',
    bar: 'bg-zinc-400',
  },
  sent: {
    label: 'Sent',
    cls: 'bg-blue-100 text-blue-700',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    bar: 'bg-blue-500',
  },
  partial: {
    label: 'Deposit Rcvd',
    cls: 'bg-amber-100 text-amber-700',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    bar: 'bg-amber-500',
  },
  paid: {
    label: 'Paid',
    cls: 'bg-green-100 text-green-700',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    bar: 'bg-green-500',
  },
  overdue: {
    label: 'Late',
    cls: 'bg-red-100 text-red-600',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    bar: 'bg-red-500',
  },
};

// ── Project status ─────────────────────────────────────────────────────────────
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; cls: string }> = {
  draft: { label: 'Quoted', cls: 'bg-zinc-700 text-zinc-300' },
  confirmed: { label: 'Active', cls: 'bg-sky-500/20 text-sky-300' },
  'in-progress': { label: 'Active', cls: 'bg-sky-500/20 text-sky-300' },
  'on-hold': { label: 'On Hold', cls: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Done', cls: 'bg-emerald-500/20 text-emerald-300' },
};

// ── Project scope item status ──────────────────────────────────────────────────
export const ITEM_STATUS_CONFIG: Record<ProjectItemStatus, { label: string; cls: string }> = {
  todo: { label: 'To Do', cls: 'bg-zinc-100 text-zinc-500' },
  'in-progress': { label: 'In Progress', cls: 'bg-amber-100 text-amber-700' },
  done: { label: 'Done', cls: 'bg-green-100 text-green-700' },
};

export const ITEM_STATUS_NEXT: Record<ProjectItemStatus, ProjectItemStatus> = {
  todo: 'in-progress',
  'in-progress': 'done',
  done: 'todo',
};
