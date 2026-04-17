'use client';

import { useState, useTransition } from 'react';
import type { Invoice, Client, InvoiceStatus } from '@/src/types';
import { useInvoiceMutations } from '@/src/hooks/useInvoices';
import { calcSubtotal, calcBalance, calcEarned } from '@/src/features/invoices/lib/calculations';
import { fmtUSD } from '@/src/lib/formatters';
import { STATUS_CONFIG } from '@/src/config/statusConfig';

interface Props {
  onClose: () => void;
  invoices: Invoice[];
  clients: Client[];
}

const fmt = fmtUSD;

function actionFor(
  status: InvoiceStatus,
  hasDeposit: boolean
): { label: string; to: InvoiceStatus } | null {
  if (status === 'draft') return { label: 'Mark sent', to: 'sent' };
  if (status === 'sent')
    return hasDeposit
      ? { label: 'Accept deposit', to: 'partial' }
      : { label: 'Mark paid', to: 'paid' };
  if (status === 'partial') return { label: 'Final payment', to: 'paid' };
  if (status === 'overdue') return { label: 'Mark paid', to: 'paid' };
  return null;
}

const CONFIRM_COPY: Partial<Record<string, { title: string; desc: string }>> = {
  'sent→partial': {
    title: 'Accept deposit',
    desc: 'Confirm the client has paid the deposit. Invoice moves to "Deposit Rcvd" — collect the balance later.',
  },
  'partial→paid': {
    title: 'Final payment received',
    desc: 'Confirm the client has paid the remaining balance. Invoice will be marked as fully Paid.',
  },
  'sent→paid': { title: 'Mark as paid', desc: 'Confirm the client has paid the full amount.' },
  'overdue→paid': { title: 'Mark as paid', desc: 'Confirm the client has paid the full amount.' },
  'draft→sent': {
    title: 'Mark as sent',
    desc: 'Confirm this invoice has been sent to the client.',
  },
};

export default function QuickPayModal({ onClose, invoices, clients }: Props) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<{
    id: string;
    from: InvoiceStatus;
    to: InvoiceStatus;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { updateStatus } = useInvoiceMutations();

  const q = query.trim().toLowerCase();

  const actionable = invoices.filter(
    (inv) => actionFor(inv.status ?? 'draft', inv.depositPercent != null) !== null
  );

  const filtered = q
    ? actionable.filter((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        return (
          inv.number.toLowerCase().includes(q) || (client?.name ?? '').toLowerCase().includes(q)
        );
      })
    : actionable;

  function handleConfirm() {
    if (!confirm) return;
    const { id, to } = confirm;
    startTransition(async () => {
      await updateStatus(id, to);
      setConfirm(null);
    });
  }

  // ── Confirm screen ──────────────────────────────────────────────────────────
  if (confirm) {
    const { from, to } = confirm;
    const copy = CONFIRM_COPY[`${from}→${to}`];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-1">
            {copy?.title ?? 'Change status?'}
          </h2>
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[from].cls}`}
            >
              {STATUS_CONFIG[from].label}
            </span>
            <svg
              className="w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[to].cls}`}
            >
              {STATUS_CONFIG[to].label}
            </span>
          </div>
          {copy && <p className="text-sm text-zinc-500 mb-6">{copy.desc}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setConfirm(null)}
              className="flex-1 h-11 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 h-11 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main screen ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Clear Payment</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Search by client or invoice number</p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Client name or invoice number…"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent bg-zinc-50 transition"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-10">
              {q ? `No results for "${query}"` : 'No pending invoices'}
            </p>
          ) : (
            filtered.map((inv) => {
              const client = clients.find((c) => c.id === inv.clientId);
              const status = inv.status ?? 'draft';
              const sc = STATUS_CONFIG[status];
              const sub = calcSubtotal(inv);
              const earned = calcEarned(inv);
              const balance = calcBalance(inv);
              const action = actionFor(status, inv.depositPercent != null)!;

              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900">{inv.number}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {client?.name ?? '—'}
                      {status === 'partial' ? (
                        <>
                          {' '}
                          · paid <span className="amt">{fmt(earned)}</span> · balance{' '}
                          <span className="amt">{fmt(balance)}</span>
                        </>
                      ) : (
                        <>
                          {' '}
                          · <span className="amt">{fmt(sub)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirm({ id: inv.id, from: status, to: action.to })}
                    className="shrink-0 h-10 px-4 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition whitespace-nowrap"
                  >
                    {action.label}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
