'use client';

import { useState, useTransition } from 'react';
import type { Invoice, Client, InvoiceStatus } from '@/src/types';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useClients } from '@/src/hooks/useClients';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { useInvoiceMutations } from '@/src/hooks/useInvoices';
import {
  calcSubtotal,
  calcNet,
  calcEarned,
  calcBalance,
  taxConfigFromPrefs,
} from '@/src/lib/calculations';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import ModalShell from '@/src/components/ModalShell';
import InvoicePreviewModal from '@/src/components/InvoicePreviewModal';
import { useAppPreferences, useCurrency } from '@/src/hooks/useAppPreferences';

// ── Payment action buttons ────────────────────────────────────────────────────

function PaymentActions({
  inv,
  onAction,
}: {
  inv: Invoice;
  onAction: (id: string, from: InvoiceStatus, to: InvoiceStatus) => void;
}) {
  const status = inv.status ?? 'draft';
  const base = 'h-10 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap';
  if (status === 'draft')
    return (
      <button
        onClick={() => onAction(inv.id, 'draft', 'sent')}
        className={`${base} bg-blue-500/15 border border-blue-400/30 text-blue-300 hover:bg-blue-500/25`}
      >
        Mark Sent
      </button>
    );
  if (status === 'sent' && inv.depositPercent != null)
    return (
      <button
        onClick={() => onAction(inv.id, 'sent', 'partial')}
        className={`${base} bg-amber-500/15 border border-amber-400/30 text-amber-300 hover:bg-amber-500/25`}
      >
        Accept deposit
      </button>
    );
  if (status === 'partial')
    return (
      <button
        onClick={() => onAction(inv.id, 'partial', 'paid')}
        className={`${base} bg-green-500/15 border border-green-400/30 text-green-300 hover:bg-green-500/25`}
      >
        Final payment
      </button>
    );
  if (status === 'sent' && inv.depositPercent == null)
    return (
      <button
        onClick={() => onAction(inv.id, 'sent', 'paid')}
        className={`${base} bg-green-500/15 border border-green-400/30 text-green-300 hover:bg-green-500/25`}
      >
        Mark paid
      </button>
    );
  if (status === 'overdue')
    return (
      <button
        onClick={() => onAction(inv.id, 'overdue', 'paid')}
        className={`${base} bg-green-500/15 border border-green-400/30 text-green-300 hover:bg-green-500/25`}
      >
        Mark paid
      </button>
    );
  return null;
}

// ── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({
  inv,
  clients,
  showReceived,
  showBalance,
  onAction,
  onPreview,
}: {
  inv: Invoice;
  clients: Client[];
  showReceived?: boolean;
  showBalance?: boolean;
  onAction: (id: string, from: InvoiceStatus, to: InvoiceStatus) => void;
  onPreview: (id: string) => void;
}) {
  const rowPrefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const rowTaxConfig = taxConfigFromPrefs(rowPrefs);

  const client = clients.find((c) => c.id === inv.clientId);
  const sub = calcSubtotal(inv);
  const net = calcNet(inv, rowTaxConfig);
  const invDeposit = inv.depositPercent != null ? net * (inv.depositPercent / 100) : null;
  const invBalance = invDeposit != null ? net - invDeposit : null;
  const received = calcEarned(inv, rowTaxConfig);
  const balance = calcBalance(inv, rowTaxConfig);
  const sc = STATUS_CONFIG[inv.status ?? 'draft'];

  return (
    <tr className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition text-sm">
      <td className="px-4 py-3.5 whitespace-nowrap">
        <button
          onClick={() => onPreview(inv.id)}
          className="font-semibold text-white hover:text-[#FFC206] transition text-left"
        >
          {inv.number}
        </button>
      </td>
      <td className="px-4 py-3.5 text-white/60 truncate max-w-[160px]">{client?.name ?? '—'}</td>
      <td className="px-4 py-3.5 text-white/50 whitespace-nowrap hidden sm:table-cell">
        {inv.date}
      </td>
      <td className="px-4 py-3.5 text-right whitespace-nowrap">
        <span className="font-semibold text-white amt">{fmt(sub)}</span>
        {net !== sub && (
          <div className="flex flex-col items-end gap-0.5 mt-0.5">
            <span className="text-xs text-orange-400/80">
              −<span className="amt">{fmt(sub - net)}</span>{' '}
              {rowTaxConfig.enabled ? rowTaxConfig.label : 'tax'}
            </span>
            <span className="text-xs font-medium text-white/70">
              <span className="amt">{fmt(net)}</span> net
            </span>
          </div>
        )}
        {invBalance != null && (
          <div className="flex flex-col items-end gap-0.5 mt-0.5">
            <span className="text-xs text-white/35">
              <span className="amt">{fmt(invDeposit!)}</span> dep ·{' '}
              <span className="amt">{fmt(invBalance)}</span> bal
            </span>
          </div>
        )}
      </td>
      {showReceived && (
        <td className="px-4 py-3.5 text-right font-bold text-green-400 whitespace-nowrap amt">
          {fmt(received)}
        </td>
      )}
      {showBalance && (
        <td className="px-4 py-3.5 text-right font-bold text-amber-400 whitespace-nowrap amt">
          {fmt(balance)}
        </td>
      )}
      <td className="px-4 py-3.5">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
          {sc.label}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right">
        <PaymentActions inv={inv} onAction={onAction} />
      </td>
    </tr>
  );
}

// ── Mobile payment card ───────────────────────────────────────────────────────

function PaymentCard({
  inv,
  clients,
  showReceived,
  showBalance,
  onAction,
  onPreview,
}: {
  inv: Invoice;
  clients: Client[];
  showReceived?: boolean;
  showBalance?: boolean;
  onAction: (id: string, from: InvoiceStatus, to: InvoiceStatus) => void;
  onPreview: (id: string) => void;
}) {
  const prefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const taxConfig = taxConfigFromPrefs(prefs);
  const client = clients.find((c) => c.id === inv.clientId);
  const sub = calcSubtotal(inv);
  const net = calcNet(inv, taxConfig);
  const received = calcEarned(inv, taxConfig);
  const balance = calcBalance(inv, taxConfig);
  const sc = STATUS_CONFIG[inv.status ?? 'draft'];

  return (
    <div className="bg-white/[0.05] border border-white/[0.09] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <button
            onClick={() => onPreview(inv.id)}
            className="font-bold text-white hover:text-[#FFC206] transition text-left"
          >
            {inv.number}
          </button>
          <p className="text-xs text-white/50 mt-0.5 truncate">{client?.name ?? '—'}</p>
          <p className="text-xs text-white/30 mt-0.5">{inv.date}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
            {sc.label}
          </span>
          <PaymentActions inv={inv} onAction={onAction} />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <div className="flex-1 bg-white/[0.06] rounded-xl p-2 text-center">
          <p className="text-xs text-white font-semibold amt">{fmt(sub)}</p>
          <p className="text-[10px] text-white/35 mt-0.5">Total</p>
        </div>
        {showReceived && (
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
            <p className="text-xs text-emerald-400 font-semibold amt">{fmt(received)}</p>
            <p className="text-[10px] text-emerald-400/50 mt-0.5">Received</p>
          </div>
        )}
        {showBalance && (
          <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
            <p className="text-xs text-amber-400 font-semibold amt">{fmt(balance)}</p>
            <p className="text-[10px] text-amber-400/50 mt-0.5">Balance</p>
          </div>
        )}
        {!showReceived && !showBalance && net !== sub && (
          <div className="flex-1 bg-white/[0.06] rounded-xl p-2 text-center">
            <p className="text-xs text-white/70 font-semibold amt">{fmt(net)}</p>
            <p className="text-[10px] text-white/35 mt-0.5">Net</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-3">
        <span className={`text-sm font-bold ${accent ?? 'text-white/70'}`}>{title}</span>
        <span className="text-xs text-white/35">
          {count} invoice{count !== 1 ? 's' : ''}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: clients } = useClients();
  const prefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const taxConfig = taxConfigFromPrefs(prefs);

  const [isPending, startTransition] = useTransition();
  const { updateStatus } = useInvoiceMutations();
  const [statusChange, setStatusChange] = useState<{
    id: string;
    from: InvoiceStatus;
    to: InvoiceStatus;
  } | null>(null);
  const [previewInvId, setPreviewInvId] = useState<string | null>(null);

  if (isLoading) return <TablePageSkeleton />;

  function handleAction(id: string, from: InvoiceStatus, to: InvoiceStatus) {
    setStatusChange({ id, from, to });
  }

  function confirmChange() {
    if (!statusChange) return;
    startTransition(async () => {
      await updateStatus(statusChange.id, statusChange.to);
      setStatusChange(null);
    });
  }

  const paid = invoices.filter((inv) => inv.status === 'paid');
  const partial = invoices.filter((inv) => inv.status === 'partial');
  const unpaid = invoices.filter((inv) => inv.status === 'sent' || inv.status === 'overdue');
  const draft = invoices.filter((inv) => inv.status === 'draft');

  const totalReceived = invoices.reduce((s, inv) => s + calcEarned(inv, taxConfig), 0);
  const awaitingFinalTotal = partial.reduce((s, inv) => s + calcBalance(inv, taxConfig), 0);
  const depositReceivedTotal = partial.reduce((s, inv) => s + calcEarned(inv, taxConfig), 0);
  const outstandingTotal = unpaid.reduce((s, inv) => s + calcBalance(inv, taxConfig), 0);

  const previewInv = previewInvId ? (invoices.find((i) => i.id === previewInvId) ?? null) : null;
  const previewClient = previewInv
    ? (clients.find((c) => c.id === previewInv.clientId) ?? null)
    : null;

  const tableHead = (cols: string[]) => (
    <thead>
      <tr className="border-b border-white/[0.08] bg-white/[0.04] text-xs font-medium text-white/45">
        {cols.map((h, i) => (
          <th
            key={`${h}-${i}`}
            className={[
              'px-4 py-3',
              ['Total', 'Deposit rcvd', 'Balance due', 'Received'].includes(h)
                ? 'text-right'
                : 'text-left',
              ['Client', 'Date'].includes(h) ? 'hidden sm:table-cell' : '',
            ]
              .join(' ')
              .trim()}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );

  const glassTable =
    'bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden overflow-x-auto';

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-sm text-white/45 mt-0.5">
          Track received, pending, and outstanding payments
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total received',
            value: fmt(totalReceived),
            sub: `${paid.length} paid · ${partial.length} deposit held`,
            color: 'text-green-400',
            accent: 'border-l-green-400',
            isAmount: true,
          },
          {
            label: 'Awaiting final',
            value: fmt(awaitingFinalTotal),
            sub: null as string | null,
            subNode: (
              <>
                {partial.length} invoice{partial.length !== 1 ? 's' : ''} ·{' '}
                <span className="amt">{fmt(depositReceivedTotal)}</span> dep held
              </>
            ),
            color: 'text-amber-400',
            accent: 'border-l-amber-400',
            isAmount: true,
          },
          {
            label: 'Outstanding',
            value: fmt(outstandingTotal),
            sub: `${unpaid.filter((i) => i.status === 'sent').length} sent · ${unpaid.filter((i) => i.status === 'overdue').length} late`,
            color: unpaid.some((i) => i.status === 'overdue') ? 'text-red-400' : 'text-white',
            accent: unpaid.some((i) => i.status === 'overdue') ? 'border-l-red-400' : '',
            isAmount: true,
          },
          {
            label: 'Draft',
            value: String(draft.length),
            sub: 'not yet sent',
            color: 'text-white/45',
            accent: '',
            isAmount: false,
          },
        ].map(({ label, value, sub, subNode, color, accent, isAmount }) => (
          <div
            key={label}
            className={`bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-5 ${accent ? `border-l-4 ${accent}` : ''}`}
          >
            <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold leading-tight ${color}`}>
              {isAmount ? <span className="amt">{value}</span> : value}
            </p>
            <p className="text-xs text-white/35 mt-1">{subNode ?? sub}</p>
          </div>
        ))}
      </div>

      {partial.length > 0 && (
        <Section title="Awaiting final payment" count={partial.length} accent="text-amber-400">
          <div className="flex flex-col gap-3 md:hidden">
            {partial.map((inv) => (
              <PaymentCard
                key={inv.id}
                inv={inv}
                clients={clients}
                showReceived
                showBalance
                onAction={handleAction}
                onPreview={setPreviewInvId}
              />
            ))}
          </div>
          <div className={`hidden md:block ${glassTable}`}>
            <table className="w-full text-sm">
              {tableHead([
                'Invoice',
                'Client',
                'Date',
                'Total',
                'Deposit rcvd',
                'Balance due',
                'Status',
                '',
              ])}
              <tbody>
                {partial.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    clients={clients}
                    showReceived
                    showBalance
                    onAction={handleAction}
                    onPreview={setPreviewInvId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {unpaid.length > 0 && (
        <Section
          title="Outstanding"
          count={unpaid.length}
          accent={unpaid.some((i) => i.status === 'overdue') ? 'text-red-400' : 'text-blue-400'}
        >
          <div className="flex flex-col gap-3 md:hidden">
            {unpaid.map((inv) => (
              <PaymentCard
                key={inv.id}
                inv={inv}
                clients={clients}
                onAction={handleAction}
                onPreview={setPreviewInvId}
              />
            ))}
          </div>
          <div className={`hidden md:block ${glassTable}`}>
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Status', ''])}
              <tbody>
                {unpaid.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    clients={clients}
                    onAction={handleAction}
                    onPreview={setPreviewInvId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {paid.length > 0 && (
        <Section title="Fully paid" count={paid.length} accent="text-green-400">
          <div className="flex flex-col gap-3 md:hidden">
            {paid.map((inv) => (
              <PaymentCard
                key={inv.id}
                inv={inv}
                clients={clients}
                showReceived
                onAction={handleAction}
                onPreview={setPreviewInvId}
              />
            ))}
          </div>
          <div className={`hidden md:block ${glassTable}`}>
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Received', 'Status', ''])}
              <tbody>
                {paid.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    clients={clients}
                    showReceived
                    onAction={handleAction}
                    onPreview={setPreviewInvId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {draft.length > 0 && (
        <Section title="Draft" count={draft.length} accent="text-white/45">
          <div className="flex flex-col gap-3 md:hidden">
            {draft.map((inv) => (
              <PaymentCard
                key={inv.id}
                inv={inv}
                clients={clients}
                onAction={handleAction}
                onPreview={setPreviewInvId}
              />
            ))}
          </div>
          <div className={`hidden md:block ${glassTable}`}>
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Status', ''])}
              <tbody>
                {draft.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    clients={clients}
                    onAction={handleAction}
                    onPreview={setPreviewInvId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-white/35">
          <p className="text-sm">No invoices yet.</p>
        </div>
      )}

      {previewInvId && (
        <InvoicePreviewModal
          inv={previewInv}
          client={previewClient}
          onClose={() => setPreviewInvId(null)}
        />
      )}

      {statusChange &&
        (() => {
          const { from, to } = statusChange;
          const hint =
            from === 'sent' && to === 'partial'
              ? {
                  title: 'Accept deposit',
                  desc: 'Confirm the client has paid the deposit. Invoice moves to "Deposit Rcvd" — collect the balance later.',
                }
              : from === 'partial' && to === 'paid'
                ? {
                    title: 'Final payment received',
                    desc: 'Confirm the client has paid the remaining balance. Invoice will be marked as fully Paid.',
                  }
                : (from === 'sent' || from === 'overdue') && to === 'paid'
                  ? { title: 'Mark as paid', desc: 'Confirm the client has paid the full amount.' }
                  : null;
          return (
            <ModalShell onClose={() => setStatusChange(null)} maxWidth="max-w-sm">
              <div className="p-6">
                <h2 className="text-lg font-bold text-zinc-900 mb-1">
                  {hint?.title ?? 'Change status?'}
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
                {hint && <p className="text-sm text-zinc-500 mb-6">{hint.desc}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStatusChange(null)}
                    className="flex-1 h-11 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmChange}
                    disabled={isPending}
                    className="flex-1 h-11 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition disabled:opacity-60"
                  >
                    {isPending ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </ModalShell>
          );
        })()}
    </div>
  );
}
