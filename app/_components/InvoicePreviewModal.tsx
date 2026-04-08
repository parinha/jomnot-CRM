'use client';

import { useStore } from '@/app/dashboard/AppStore';
import { fmtUSD } from '@/app/_lib/formatters';
import { WHT_RATE } from '@/app/_services/invoiceService';
import { STATUS_CONFIG } from '@/app/_config/statusConfig';

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

  const subtotal = inv ? inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0) : 0;
  const whtAmount = inv?.withWHT ? subtotal * WHT_RATE : null;
  const netTotal = inv?.withWHT ? subtotal * (1 - WHT_RATE) : subtotal;
  const depositAmount = inv?.depositPercent != null ? netTotal * (inv.depositPercent / 100) : null;
  const balanceDue = depositAmount != null ? netTotal - depositAmount : null;
  const sc = inv ? STATUS_CONFIG[inv.status ?? 'draft'] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {!inv ? (
          <div className="p-8 text-center text-white/40 text-sm">Invoice not found.</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-white">{inv.number}</h2>
                  {sc && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
                      {sc.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/45 mt-0.5">
                  {client?.name ?? '—'} · {inv.date}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <a
                  href={`/invoices/${inv.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/15 transition"
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
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
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
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Meta row */}
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-white/35 text-xs block mb-0.5">Payment Terms</span>
                  <span className="text-white/80">{inv.paymentTerms ?? 'Due on receipt'}</span>
                </div>
                {client?.email && (
                  <div>
                    <span className="text-white/35 text-xs block mb-0.5">Email</span>
                    <span className="text-white/80">{client.email}</span>
                  </div>
                )}
                {client?.phone && (
                  <div>
                    <span className="text-white/35 text-xs block mb-0.5">Phone</span>
                    <span className="text-white/80">{client.phone}</span>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.06] border-b border-white/[0.08]">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-white/45">
                        Description
                      </th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-white/45 w-12">
                        Qty
                      </th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-white/45 w-24 hidden sm:table-cell">
                        Unit Price
                      </th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-white/45 w-24">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-3 py-2.5 text-white/80 whitespace-pre-line">
                          {item.description}
                        </td>
                        <td className="px-3 py-2.5 text-center text-white/50">{item.qty}</td>
                        <td className="px-3 py-2.5 text-right text-white/50 hidden sm:table-cell">
                          {fmt(item.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-white">
                          {fmt(item.qty * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex flex-col items-end gap-1.5 text-sm">
                <div className="flex gap-8 pt-1.5 border-t border-white/[0.08]">
                  <span className="font-semibold text-white/60">Grand Total</span>
                  <span className="font-bold text-white w-28 text-right">{fmt(subtotal)}</span>
                </div>
                {whtAmount != null && (
                  <>
                    <div className="flex gap-8 text-orange-400">
                      <span>Less WHT {WHT_RATE * 100}%</span>
                      <span className="font-medium w-28 text-right">({fmt(whtAmount)})</span>
                    </div>
                    <div className="flex gap-8 pt-1.5 border-t border-white/[0.08] mt-0.5">
                      <span className="font-semibold text-white/60">Total (USD)</span>
                      <span className="font-bold text-white w-28 text-right">{fmt(netTotal)}</span>
                    </div>
                  </>
                )}
                {depositAmount != null && balanceDue != null && (
                  <>
                    <div className="flex gap-8 text-green-400">
                      <span>Deposit ({inv.depositPercent}%)</span>
                      <span className="font-medium w-28 text-right">− {fmt(depositAmount)}</span>
                    </div>
                    <div className="flex gap-8 pt-1.5 border-t border-white/[0.08] mt-0.5">
                      <span className="font-semibold text-white/60">Balance Due</span>
                      <span className="font-bold text-white w-28 text-right">
                        {fmt(balanceDue)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Notes */}
              {inv.notes && (
                <div>
                  <p className="text-xs font-semibold text-white/35 uppercase tracking-wide mb-1.5">
                    Notes
                  </p>
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{inv.notes}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
