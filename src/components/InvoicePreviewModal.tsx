'use client';

import { X } from '@phosphor-icons/react';
import type { Invoice, Client } from '@/src/types';
import ModalShell from '@/src/components/ModalShell';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import { calcTaxAmount, calcNet } from '@/src/lib/calculations';
import { useCurrency } from '@/src/hooks/useAppPreferences';
import { useAppPreferences } from '@/src/hooks/useAppPreferences';
import { taxConfigFromPrefs } from '@/src/lib/calculations';

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
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">{inv?.number ?? '—'}</h2>
            <p className="text-xs text-muted mt-0.5">{client?.name ?? '—'}</p>
          </div>
          {sc && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-muted hover:bg-black/[0.04] hover:text-ink transition"
        >
          <X className="w-5 h-5" weight="bold" aria-hidden />
        </button>
      </div>

      {/* Body */}
      {!inv ? (
        <div className="flex-1 flex items-center justify-center py-10 text-muted text-sm">
          Invoice not found.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4">
          {/* Line items */}
          <div>
            <p className="text-sm font-semibold text-ink mb-2">Line Items</p>
            <div className="flex flex-col gap-1">
              {inv.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between py-2 border-b border-line"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{it.description || '—'}</p>
                    <p className="text-xs text-muted">
                      {it.qty} × {fmt(it.unitPrice)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink shrink-0 ml-3">
                    {fmt(it.qty * it.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-subtle rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span className="font-medium text-ink">{fmt(subtotal)}</span>
            </div>
            {whtAmount !== null && (
              <div className="flex justify-between text-sm text-amber-600">
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
            <div className="flex justify-between text-sm font-bold text-ink border-t border-line pt-2 mt-1">
              <span>Net Total</span>
              <span>{fmt(netTotal)}</span>
            </div>
            {depositAmount !== null && (
              <>
                <div className="flex justify-between text-sm text-brand-ink">
                  <span>Deposit ({inv.depositPercent}%)</span>
                  <span>{fmt(depositAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-ink-2">
                  <span>Balance Due</span>
                  <span>{fmt(balanceDue ?? 0)}</span>
                </div>
              </>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted mb-0.5">Date</p>
              <p className="text-ink">{inv.date}</p>
            </div>
            <div>
              <p className="text-muted mb-0.5">Terms</p>
              <p className="text-ink">{inv.paymentTerms || '—'}</p>
            </div>
          </div>

          {inv.notes && (
            <div>
              <p className="text-sm font-semibold text-ink mb-1">Notes</p>
              <p className="text-sm text-ink-2 whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-line shrink-0 flex justify-end gap-3">
        <a
          href={inv ? `/invoices/${inv.id}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 px-5 rounded-full bg-brand-soft border border-brand/40 text-brand-ink text-sm font-semibold hover:bg-brand/15 transition flex items-center"
        >
          Open PDF
        </a>
        <button
          onClick={onClose}
          className="h-11 px-5 rounded-full border border-line-strong text-sm font-medium text-ink-2 hover:bg-black/[0.04] transition"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
