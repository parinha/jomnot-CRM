'use client';

import type { Invoice, Client } from '@/src/types';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import { calcTaxAmount, calcNet } from '@/src/features/invoices/lib/calculations';
import { useCurrency } from '@/src/contexts/AppPreferencesContext';
import { useAppPreferences } from '@/src/contexts/AppPreferencesContext';
import { taxConfigFromPrefs } from '@/src/features/invoices/lib/calculations';

export default function InvoicePreviewModal({
  inv,
  client,
  onClose,
}: {
  inv: Invoice | null;
  client: Client | null;
  onClose: () => void;
}) {
  const prefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const taxConfig = taxConfigFromPrefs(prefs);

  const subtotal = inv ? inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0) : 0;
  const whtAmount = inv ? calcTaxAmount(inv, taxConfig) : null;
  const netTotal = inv ? calcNet(inv, taxConfig) : subtotal;
  const depositAmount = inv?.depositPercent != null ? netTotal * (inv.depositPercent / 100) : null;
  const balanceDue = depositAmount != null ? netTotal - depositAmount : null;
  const sc = inv ? STATUS_CONFIG[inv.status ?? 'draft'] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-white">{inv?.number ?? '—'}</h2>
              <p className="text-xs text-white/40 mt-0.5">{client?.name ?? '—'}</p>
            </div>
            {sc && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}>
                {sc.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
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

        {/* Body */}
        {!inv ? (
          <div className="flex-1 flex items-center justify-center py-10 text-white/40 text-sm">
            Invoice not found.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {/* Line items */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                Line Items
              </p>
              <div className="flex flex-col gap-1">
                {inv.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between py-2 border-b border-white/[0.05]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{it.description || '—'}</p>
                      <p className="text-xs text-white/40">
                        {it.qty} × {fmt(it.unitPrice)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-white shrink-0 ml-3">
                      {fmt(it.qty * it.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white/[0.05] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-white/60">
                <span>Subtotal</span>
                <span className="font-medium text-white">{fmt(subtotal)}</span>
              </div>
              {whtAmount !== null && (
                <div className="flex justify-between text-sm text-amber-400/80">
                  <span>
                    {taxConfig.enabled ? taxConfig.label : 'WHT'} (
                    {taxConfig.enabled ? taxConfig.rate : 15}%)
                  </span>
                  <span className="font-medium">
                    {taxConfig.type === 'additive' ? '+' : '−'}
                    {fmt(whtAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-2 mt-1">
                <span>Net Total</span>
                <span>{fmt(netTotal)}</span>
              </div>
              {depositAmount !== null && (
                <>
                  <div className="flex justify-between text-sm text-green-400/80">
                    <span>Deposit ({inv.depositPercent}%)</span>
                    <span>{fmt(depositAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-white/80">
                    <span>Balance Due</span>
                    <span>{fmt(balanceDue ?? 0)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-white/40 uppercase tracking-wider mb-0.5">Date</p>
                <p className="text-white">{inv.date}</p>
              </div>
              <div>
                <p className="text-white/40 uppercase tracking-wider mb-0.5">Terms</p>
                <p className="text-white">{inv.paymentTerms || '—'}</p>
              </div>
            </div>

            {inv.notes && (
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
                  Notes
                </p>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{inv.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] shrink-0 flex justify-end gap-3">
          <a
            href={inv ? `/invoices/${inv.id}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-5 rounded-xl bg-[#FFC206]/15 border border-[#FFC206]/30 text-[#FFC206] text-sm font-semibold hover:bg-[#FFC206]/25 transition flex items-center"
          >
            Open PDF
          </a>
          <button
            onClick={onClose}
            className="h-11 px-5 rounded-xl border border-white/20 text-sm font-medium text-white/70 hover:bg-white/10 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
