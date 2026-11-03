'use client';

import {
  CircleNotch,
  Eye,
  Plus,
  Printer,
  Receipt as ReceiptIcon,
  TelegramLogo,
  Trash,
  X,
} from '@phosphor-icons/react';
import { createElement, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { CompanyProfile, Invoice, Receipt, ReceiptKind } from '@/src/types';
import ModalShell from '@/src/components/ModalShell';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';
import { ReceiptSheet, receiptCaption } from '@/src/components/ReceiptPrint';
import { useReceipts, useReceiptMutations } from '@/src/hooks/useReceipts';
import { useInvoiceMutations } from '@/src/hooks/useInvoices';
import { useClients } from '@/src/hooks/useClients';
import { useCompanyProfile, usePaymentInfo } from '@/src/hooks/useSettings';
import { useAppPreferences, useCurrency, useDateFmt } from '@/src/hooks/useAppPreferences';
import {
  amountForKind,
  amountInWords,
  DEFAULT_RECEIPT_MESSAGE,
  invoiceTotals,
  nextReceiptNumber,
  r2,
  RECEIPT_KIND_LABEL,
  RECEIPT_METHODS,
  suggestKind,
} from '@/src/lib/receipt';
import { localToday } from '@/src/lib/quotation';
import { telegramTarget, sendTelegramDocument, sheetToPdfBlob } from '@/src/lib/pdf';
import { uid } from '@/src/lib/id';

const inputCls =
  'h-11 rounded-xl border border-line bg-subtle px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand focus:bg-surface transition w-full';

type Draft = Omit<
  Receipt,
  'id' | 'number' | 'invoiceId' | 'clientId' | 'invoiceTotal' | 'previouslyPaid'
>;

/** Receipts list + "Create receipt" for one invoice (shown in the invoice detail sheet). */
export default function InvoiceReceipts({ invoice }: { invoice: Invoice }) {
  const { data: allReceipts } = useReceipts();
  const { upsert, remove } = useReceiptMutations();
  const { upsert: upsertInvoice } = useInvoiceMutations();
  const { data: clients } = useClients();
  const { data: companyProfile } = useCompanyProfile();
  const { data: paymentInfo } = usePaymentInfo();
  const prefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const fmtDt = useDateFmt();
  const [isPending, startTransition] = useTransition();

  const receipts = allReceipts
    .filter((r) => r.invoiceId === invoice.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  const paid = r2(receipts.reduce((s, r) => s + r.amount, 0));
  const totals = invoiceTotals(invoice, { taxRate: prefs.taxRate, taxType: prefs.taxType });
  const remaining = Math.max(0, r2(totals.net - paid));
  const client = clients.find((c) => c.id === invoice.clientId) ?? null;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [markStatus, setMarkStatus] = useState(true);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    const kind = suggestKind(invoice, totals, paid);
    setDraft({
      date: localToday(),
      kind,
      amount: amountForKind(kind, totals, paid),
      method: RECEIPT_METHODS[0],
      reference: '',
      message: DEFAULT_RECEIPT_MESSAGE,
      showStamp: true,
      showWords: true,
      showItems: true,
      showProgress: true,
      showCustomerSignature: false,
    });
    setMarkStatus(true);
    setError('');
    setOpen(true);
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  const balanceAfter = draft ? r2(totals.net - paid - draft.amount) : 0;
  const nextStatus = balanceAfter <= 0.005 ? 'paid' : 'partial';

  function save(openPdf: boolean) {
    if (!draft) return;
    if (!(draft.amount > 0)) return setError('Enter the amount received.');
    if (!draft.date) return setError('Enter the date the payment was received.');
    if (!draft.method.trim()) return setError('Enter the payment method.');
    const receipt: Receipt = {
      ...draft,
      reference: draft.reference?.trim() || undefined,
      amount: r2(draft.amount),
      id: uid(),
      number: nextReceiptNumber(allReceipts),
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      invoiceTotal: totals.net,
      previouslyPaid: paid,
      createdAt: new Date().toISOString(),
    };
    const win = openPdf ? window.open('', '_blank') : null;
    startTransition(async () => {
      try {
        await upsert(receipt);
        if (markStatus && invoice.status !== nextStatus) {
          await upsertInvoice({ ...invoice, status: nextStatus });
        }
        if (win) win.location.href = `/receipts/${receipt.id}`;
        toast.success(`Receipt ${receipt.number} created`);
        setOpen(false);
      } catch (e) {
        win?.close();
        setError(e instanceof Error ? e.message : 'Could not save the receipt');
      }
    });
  }

  async function sendToTelegram(r: Receipt) {
    const { token, chatId, topicId } = telegramTarget(paymentInfo, 'receipt');
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSendingId(r.id);
    try {
      const blob = await sheetToPdfBlob(
        createElement(ReceiptSheet, {
          receipt: r,
          invoice,
          client,
          company: companyProfile ?? ({} as CompanyProfile),
          taxLabel: prefs.taxLabel,
          taxRate: prefs.taxRate,
          taxType: prefs.taxType,
          currencyCode: prefs.currencyCode,
          dateFormat: prefs.dateFormat,
        }),
        2.5
      );
      await sendTelegramDocument({
        token,
        chatId,
        topicId,
        blob,
        filename: `${r.number}.pdf`,
        caption: receiptCaption(r, invoice, client, fmt(r.amount), fmtDt(r.date)),
      });
      toast.success(`${r.number} sent to Telegram`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-ink">Receipts</p>
        {receipts.length > 0 && (
          <p className="text-xs text-muted">
            Received <span className="amt">{fmt(paid)}</span> of{' '}
            <span className="amt">{fmt(totals.net)}</span>
          </p>
        )}
      </div>

      {receipts.length > 0 && (
        <div className="flex flex-col divide-y divide-line rounded-2xl border border-line mb-2">
          {receipts.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <ReceiptIcon className="w-4 h-4" weight="duotone" aria-hidden />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {r.number} · <span className="amt">{fmt(r.amount)}</span>
                </p>
                <p className="text-xs text-muted truncate">
                  {RECEIPT_KIND_LABEL[r.kind]} · {fmtDt(r.date)} · {r.method}
                </p>
              </div>
              <a
                href={`/receipts/${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open PDF"
                aria-label={`Open ${r.number} PDF`}
                className="w-9 h-9 flex items-center justify-center rounded-full text-brand hover:bg-brand-soft transition shrink-0"
              >
                <Printer className="w-4 h-4" weight="duotone" aria-hidden />
              </a>
              <button
                onClick={() => sendToTelegram(r)}
                disabled={sendingId === r.id}
                title="Send to Telegram"
                aria-label={`Send ${r.number} to Telegram`}
                className="w-9 h-9 flex items-center justify-center rounded-full text-sky-600 hover:bg-sky-50 transition disabled:opacity-50 shrink-0"
              >
                {sendingId === r.id ? (
                  <CircleNotch className="w-4 h-4 animate-spin" weight="bold" aria-hidden />
                ) : (
                  <TelegramLogo className="w-4 h-4" weight="duotone" aria-hidden />
                )}
              </button>
              <button
                onClick={() => setDeleteId(r.id)}
                title="Delete receipt"
                aria-label={`Delete ${r.number}`}
                className="w-9 h-9 flex items-center justify-center rounded-full text-faint hover:text-red-600 hover:bg-red-50 transition shrink-0"
              >
                <Trash className="w-4 h-4" weight="duotone" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openCreate}
        className="h-10 w-full flex items-center justify-center gap-1.5 rounded-full border border-dashed border-brand/50 text-brand text-sm font-semibold hover:bg-brand-soft transition"
      >
        <Plus className="w-4 h-4" weight="bold" aria-hidden />
        {receipts.length === 0 ? 'Create receipt' : 'Add another receipt'}
      </button>
      {remaining <= 0.005 && receipts.length > 0 && (
        <p className="text-xs text-brand mt-1.5 text-center">This invoice is fully paid.</p>
      )}

      {/* ── Create receipt ───────────────────────────────────────────────── */}
      {open && draft && (
        <ModalShell onClose={() => setOpen(false)} maxWidth="max-w-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
            <div>
              <h2 className="text-lg font-bold text-ink">New receipt</h2>
              <p className="text-xs text-muted mt-0.5">
                For {invoice.number} · {client?.name ?? '—'}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted hover:text-ink transition p-1"
            >
              <X className="w-5 h-5" weight="bold" aria-hidden />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-subtle border border-line">
              {(['full', 'deposit', 'balance'] as ReceiptKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setDraft((d) =>
                      d ? { ...d, kind: k, amount: amountForKind(k, totals, paid) } : d
                    )
                  }
                  className={`h-10 rounded-lg text-sm font-semibold transition ${draft.kind === k ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}
                >
                  {k === 'full' ? 'Full' : k === 'deposit' ? 'Deposit' : 'Balance'}
                </button>
              ))}
            </div>

            <div className="bg-subtle rounded-2xl p-4 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Invoice total</span>
                <span className="font-medium text-ink amt">{fmt(totals.net)}</span>
              </div>
              {paid > 0 && (
                <div className="flex justify-between text-brand">
                  <span>Already received</span>
                  <span className="font-medium amt">{fmt(paid)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-ink border-t border-line pt-1.5 mt-0.5">
                <span>Balance after this receipt</span>
                <span className={`amt ${balanceAfter > 0.005 ? 'text-orange-600' : 'text-brand'}`}>
                  {fmt(Math.max(0, balanceAfter))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount received" htmlFor="rc-amount">
                <input
                  id="rc-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.amount || ''}
                  onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
              </Field>
              <Field label="Date paid" htmlFor="rc-date">
                <input
                  id="rc-date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => set('date', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            {draft.amount > 0 && (
              <p className="-mt-3 text-xs text-muted">
                {amountInWords(draft.amount, prefs.currencyCode)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Method" htmlFor="rc-method">
                <input
                  id="rc-method"
                  list="rc-methods"
                  value={draft.method}
                  onChange={(e) => set('method', e.target.value)}
                  className={inputCls}
                />
                <datalist id="rc-methods">
                  {RECEIPT_METHODS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <Field label="Reference (optional)" htmlFor="rc-ref">
                <input
                  id="rc-ref"
                  value={draft.reference ?? ''}
                  onChange={(e) => set('reference', e.target.value)}
                  placeholder="Transaction ID"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Thank-you message" htmlFor="rc-msg">
              <textarea
                id="rc-msg"
                rows={3}
                value={draft.message ?? ''}
                onChange={(e) => set('message', e.target.value)}
                className={`${inputCls} h-auto py-2.5 leading-relaxed resize-y`}
              />
            </Field>

            <div className="flex flex-col rounded-2xl bg-subtle divide-y divide-line">
              {(
                [
                  ['showStamp', 'PAID stamp'],
                  ['showWords', 'Amount in words'],
                  ['showItems', 'Line items from the invoice'],
                  ['showProgress', 'Payment progress bar'],
                  ['showCustomerSignature', 'Customer signature'],
                ] as const
              ).map(([key, label]) => (
                <Toggle key={key} label={label} on={draft[key]} onChange={(v) => set(key, v)} />
              ))}
            </div>

            <Toggle
              label={`Mark ${invoice.number} as ${nextStatus === 'paid' ? 'Paid' : 'Deposit Rcvd'}`}
              on={markStatus}
              onChange={setMarkStatus}
              boxed
            />
          </div>

          <div
            className="px-6 py-4 border-t border-line flex flex-col gap-3 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => save(true)}
                disabled={isPending}
                className="flex h-11 px-4 rounded-xl border border-line-strong bg-subtle text-sm text-ink hover:bg-black/[0.04] transition items-center gap-2 disabled:opacity-60"
              >
                <Eye className="w-4 h-4" weight="duotone" aria-hidden />
                Create & open PDF
              </button>
              <button
                onClick={() => save(false)}
                disabled={isPending}
                className="h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition disabled:opacity-60"
              >
                Create receipt
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteId && (
        <ConfirmDeleteModal
          title="Delete receipt?"
          onConfirm={() =>
            startTransition(async () => {
              await remove(deleteId);
              setDeleteId(null);
            })
          }
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
  boxed,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  boxed?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-ink ${boxed ? 'rounded-xl bg-brand-soft border border-brand/30 text-brand-ink' : ''}`}
    >
      {label}
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-brand' : 'bg-zinc-300'}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  );
}
