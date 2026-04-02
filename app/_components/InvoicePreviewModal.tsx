'use client';

import { useStore } from '@/app/dashboard/AppStore';
import { fmtUSD } from '@/app/_lib/formatters';
import { WHT_RATE } from '@/app/_services/invoiceService';
import { STATUS_CONFIG } from '@/app/_config/statusConfig';
import ModalShell from './ModalShell';

const fmt = fmtUSD;

export default function InvoicePreviewModal({
  invId,
  onClose,
}: {
  invId: string;
  onClose: () => void;
}) {
  const { invoices, clients } = useStore();
  const inv = invoices.find((i) => i.id === invId);
  const client = inv ? clients.find((c) => c.id === inv.clientId) : null;

  if (!inv)
    return (
      <ModalShell onClose={onClose} maxWidth="max-w-sm">
        <div className="p-8 text-center text-zinc-400 text-sm">Invoice not found.</div>
      </ModalShell>
    );

  const subtotal = inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const whtAmount = inv.withWHT ? subtotal * WHT_RATE : null;
  const netTotal = inv.withWHT ? subtotal * (1 - WHT_RATE) : subtotal;
  const depositAmount = inv.depositPercent != null ? netTotal * (inv.depositPercent / 100) : null;
  const balanceDue = depositAmount != null ? netTotal - depositAmount : null;
  const sc = STATUS_CONFIG[inv.status ?? 'draft'];

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-semibold text-zinc-900">{inv.number}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {client?.name ?? '—'} · {inv.date}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <a
              href={`/invoices/${inv.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              View PDF
            </a>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 transition">
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div>
              <span className="text-zinc-400 text-xs block">Payment Terms</span>
              <span className="text-zinc-700">{inv.paymentTerms ?? 'Due on receipt'}</span>
            </div>
            {client?.email && (
              <div>
                <span className="text-zinc-400 text-xs block">Email</span>
                <span className="text-zinc-700">{client.email}</span>
              </div>
            )}
            {client?.phone && (
              <div>
                <span className="text-zinc-400 text-xs block">Phone</span>
                <span className="text-zinc-700">{client.phone}</span>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">
                    Description
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-zinc-500 w-12">
                    Qty
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500 w-24 hidden sm:table-cell">
                    Unit Price
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500 w-24">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <tr
                    key={item.id}
                    className={`border-b border-zinc-100 last:border-0 ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-zinc-800">{item.description}</td>
                    <td className="px-3 py-2.5 text-center text-zinc-500">{item.qty}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-500 hidden sm:table-cell">
                      {fmt(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-zinc-900">
                      {fmt(item.qty * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1.5 text-sm">
            <div className="flex gap-8 pt-1.5 border-t border-zinc-200">
              <span className="font-semibold text-zinc-700">Grand Total</span>
              <span className="font-bold text-zinc-900 w-28 text-right">{fmt(subtotal)}</span>
            </div>
            {whtAmount != null && (
              <>
                <div className="flex gap-8 text-orange-700">
                  <span>Less WHT {WHT_RATE * 100}%</span>
                  <span className="font-medium w-28 text-right">({fmt(whtAmount)})</span>
                </div>
                <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5">
                  <span className="font-semibold text-zinc-700">Total (USD)</span>
                  <span className="font-bold text-zinc-900 w-28 text-right">{fmt(netTotal)}</span>
                </div>
              </>
            )}
            {depositAmount != null && balanceDue != null && (
              <>
                <div className="flex gap-8 text-green-700">
                  <span>Deposit ({inv.depositPercent}%)</span>
                  <span className="font-medium w-28 text-right">− {fmt(depositAmount)}</span>
                </div>
                <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5">
                  <span className="font-semibold text-zinc-700">Balance Due</span>
                  <span className="font-bold text-zinc-900 w-28 text-right">{fmt(balanceDue)}</span>
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          {inv.notes && (
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
                Notes
              </p>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
