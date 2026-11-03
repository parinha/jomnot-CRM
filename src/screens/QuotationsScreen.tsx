'use client';

import {
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Eye,
  HourglassMedium,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Printer,
  Receipt,
  SealCheck,
  TelegramLogo,
  Trash,
  X,
} from '@phosphor-icons/react';
import { useState, useEffect, useRef, createElement, useTransition } from 'react';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import { QuotationSheet, quoteCaption } from '@/src/components/QuotationPrint';
import type {
  CompanyProfile,
  PaymentInfo,
  PaymentMethod,
  Quotation,
  QuotationStatus,
  QuoteLineItem,
  QuoteTaxMode,
} from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useQuotations, useQuotationMutations } from '@/src/hooks/useQuotations';
import { useInvoices, useInvoiceMutations } from '@/src/hooks/useInvoices';
import { taxConfigFromPrefs } from '@/src/lib/calculations';
import { nextInvoiceNumber } from '@/src/lib/numbering';
import {
  useCompanyProfile,
  usePaymentInfo,
  usePaymentMethods,
  useInvoicingSettings,
  useScopeOfWork,
  useQuotationSettings,
} from '@/src/hooks/useSettings';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { useAppPreferences, useCurrency, useDateFmt } from '@/src/hooks/useAppPreferences';
import { uid } from '@/src/lib/id';
import { PAGE_SIZE } from '@/src/config/constants';
import { QUOTE_STATUS_CONFIG } from '@/src/config/statusConfig';
import {
  calcQuote,
  defaultTaxFromPrefs,
  effectiveQuoteStatus,
  localToday,
  nextQuotationNumber,
  quoteToInvoice,
  taxLabelFor,
  validUntil,
} from '@/src/lib/quotation';
import { telegramTarget, sendTelegramDocument, sheetToPdfBlob } from '@/src/lib/pdf';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import { PageHeader, EmptyCard } from '@/src/components/PageHeader';
import ModalShell from '@/src/components/ModalShell';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';

type FormState = Omit<Quotation, 'id'>;
type Filter = 'all' | QuotationStatus;

const PAGE_KEY = 'tbl_quote_page';

const inputCls =
  'h-11 rounded-xl border border-line bg-subtle px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand focus:bg-surface transition w-full';
const textareaCls = `${inputCls} h-auto py-2.5 leading-relaxed resize-y`;

function emptyItem(): QuoteLineItem {
  return { id: uid(), description: '', qty: 1, unitPrice: 0 };
}

export default function QuotationsScreen() {
  const { data: clients, isLoading } = useClients();
  const { data: quotes } = useQuotations();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: companyProfile } = useCompanyProfile();
  const { data: paymentInfo } = usePaymentInfo();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: invoicingSettings } = useInvoicingSettings();
  const { data: quoteDefaults } = useQuotationSettings();
  const prefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const fmtDt = useDateFmt();

  const [isPending, startTransition] = useTransition();
  const { upsert: upsertQuote, remove: deleteQuote } = useQuotationMutations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const didAutoOpen = useRef(false);
  const today = localToday();
  const { data: invoices } = useInvoices();
  const { upsert: upsertInvoice } = useInvoiceMutations();
  const [converting, setConverting] = useState<string | null>(null);

  async function convertToInvoice(q: Quotation) {
    const existing = q.invoiceId ? invoices.find((i) => i.id === q.invoiceId) : undefined;
    if (existing) {
      router.push(`/invoices?edit=${existing.id}`);
      return;
    }
    setConverting(q.id);
    try {
      const { invoice, warnings } = quoteToInvoice(q, {
        id: uid(),
        number: nextInvoiceNumber(invoices),
        date: localToday(),
        tax: taxConfigFromPrefs(prefs),
      });
      await upsertInvoice(invoice);
      await upsertQuote({ ...q, invoiceId: invoice.id });
      toast.success(`Invoice ${invoice.number} created from ${q.number}`, {
        description: warnings.length ? warnings.join(' ') : undefined,
        duration: warnings.length ? 8000 : 4000,
      });
      router.push(`/invoices?edit=${invoice.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the invoice');
    } finally {
      setConverting(null);
    }
  }

  // ── Telegram ───────────────────────────────────────────────────────────────
  const [sendingTelegram, setSendingTelegram] = useState<string | null>(null);

  function resolvePayment(q: Quotation): PaymentInfo {
    const method: PaymentMethod | undefined = q.paymentMethodId
      ? paymentMethods.find((m) => m.id === q.paymentMethodId)
      : paymentMethods.find((m) => m.isDefault);
    const src = method ?? invoicingSettings;
    return {
      ...(paymentInfo ?? {}),
      bankName: src?.bankName ?? '',
      accountName: src?.accountName ?? '',
      accountNumber: src?.accountNumber ?? '',
      swiftCode: src?.swiftCode ?? '',
      currency: src?.currency ?? '',
      qrImage: src?.qrImage ?? '',
    } as PaymentInfo;
  }

  async function sendToTelegram(q: Quotation) {
    const { token, chatId, topicId } = telegramTarget(paymentInfo, 'quote');
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSendingTelegram(q.id);
    try {
      const client = clients.find((c) => c.id === q.clientId) ?? null;
      const blob = await sheetToPdfBlob(
        createElement(QuotationSheet, {
          quote: q,
          client,
          company: companyProfile ?? ({} as CompanyProfile),
          payment: resolvePayment(q),
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
        filename: `${q.number}.pdf`,
        caption: quoteCaption(q, client, fmtDt(q.date)),
      });
      toast.success(`${q.number} sent to Telegram`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSendingTelegram(null);
    }
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [customScope, setCustomScope] = useState<Record<string, string>>({});

  const blankForm = (): FormState => ({
    number: nextQuotationNumber(quotes),
    date: localToday(),
    validDays: quoteDefaults.validDays || 14,
    status: 'draft',
    clientId: '',
    projectName: '',
    items: [emptyItem()],
    intro: quoteDefaults.intro,
    notes: '',
    discountPercent: undefined,
    ...defaultTaxFromPrefs(prefs),
    taxNote: quoteDefaults.taxNote,
    depositMode: quoteDefaults.depositPercent > 0 ? 'percent' : undefined,
    depositValue: quoteDefaults.depositPercent > 0 ? quoteDefaults.depositPercent : undefined,
    gear: quoteDefaults.gear,
    terms: quoteDefaults.terms,
    usageRights: quoteDefaults.usageRights,
    showVatTin: undefined,
    paymentMethodId: paymentMethods.find((m) => m.isDefault)?.id,
  });

  const [form, setForm] = useState<FormState>(blankForm);

  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);

  function resetPanelUi() {
    setFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setCustomScope({});
  }

  function openNew() {
    setEditingId(null);
    setForm(blankForm());
    resetPanelUi();
    setPanelOpen(true);
  }

  useEffect(() => {
    if (didAutoOpen.current) return;
    if (searchParams.get('new') === '1') {
      didAutoOpen.current = true;
      openNew();
      router.replace('/quotations');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openEdit(q: Quotation) {
    const { id: _id, ...rest } = q;
    void _id;
    setEditingId(q.id);
    setForm({
      ...rest,
      status: q.status ?? 'draft',
      validDays: q.validDays ?? 14,
      taxMode: q.taxMode ?? 'none',
      notes: q.notes ?? '',
      paymentMethodId: q.paymentMethodId ?? paymentMethods.find((m) => m.isDefault)?.id,
    });
    resetPanelUi();
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
    resetPanelUi();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function updateItem(id: string, patch: Partial<QuoteLineItem>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }
  function removeItem(id: string) {
    setForm((prev) =>
      prev.items.length > 1 ? { ...prev, items: prev.items.filter((it) => it.id !== id) } : prev
    );
  }

  function setTaxMode(mode: QuoteTaxMode) {
    setForm((prev) => {
      if (mode === 'none') return { ...prev, taxMode: 'none' };
      const fromPrefs = defaultTaxFromPrefs(prefs);
      const useP = fromPrefs.taxMode === mode;
      return {
        ...prev,
        taxMode: mode,
        taxLabel: useP ? fromPrefs.taxLabel : mode === 'vat' ? 'VAT' : 'WHT',
        taxRate: useP ? fromPrefs.taxRate : mode === 'vat' ? 10 : 15,
      };
    });
  }

  function validateForm(): string | null {
    if (!form.projectName?.trim()) return 'Project / Campaign Name is required.';
    if (!form.clientId) return 'Please select a client.';
    if (!form.number.trim()) return 'Quotation number is required.';
    const duplicate = quotes.find((q) => q.number === form.number.trim() && q.id !== editingId);
    if (duplicate) return `Quotation number "${form.number.trim()}" is already used.`;
    if (form.items.some((it) => !it.description.trim()))
      return 'All line items need a description.';
    if (!form.validDays || form.validDays < 1) return 'Valid for must be at least 1 day.';
    return null;
  }

  async function performSave(id: string) {
    const existing = quotes.find((q) => q.id === id);
    await upsertQuote({
      id,
      ...form,
      number: form.number.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  function handleSave() {
    const error = validateForm();
    if (error) return setFormError(error);
    const id = editingId ?? uid();
    startTransition(async () => {
      await performSave(id);
      closePanel();
    });
  }

  function handleSaveAndPreview() {
    const error = validateForm();
    if (error) return setFormError(error);
    const id = editingId ?? uid();
    const win = window.open('', '_blank');
    startTransition(async () => {
      await performSave(id);
      if (win) win.location.href = `/quotations/${id}`;
      closePanel();
    });
  }

  function setStatus(q: Quotation, status: QuotationStatus, after?: () => void) {
    startTransition(async () => {
      await upsertQuote({ ...q, status });
      after?.();
    });
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  // ── Filter / paginate ──────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState<number>(() =>
    typeof window !== 'undefined' ? parseInt(localStorage.getItem(PAGE_KEY) ?? '1') || 1 : 1
  );
  const [prevSearch, setPrevSearch] = useState(search);
  const [prevFilter, setPrevFilter] = useState(filter);

  if (isLoading) return <TablePageSkeleton />;

  if (prevSearch !== search || prevFilter !== filter) {
    setPrevSearch(search);
    setPrevFilter(filter);
    setPage(1);
    localStorage.setItem(PAGE_KEY, '1');
  }

  function goToPage(p: number) {
    setPage(p);
    localStorage.setItem(PAGE_KEY, String(p));
  }

  const withStatus = quotes.map((q) => ({ q, status: effectiveQuoteStatus(q, today) }));
  const count = (s: QuotationStatus) => withStatus.filter((x) => x.status === s).length;

  const filtered = withStatus.filter(({ q, status }) => {
    if (filter !== 'all' && status !== filter) return false;
    if (search.trim()) {
      const needle = search.toLowerCase();
      const client = clients.find((c) => c.id === q.clientId);
      const hay = [
        q.number,
        client?.name ?? '',
        q.projectName ?? '',
        fmt(calcQuote(q).total),
        status,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => b.q.date.localeCompare(a.q.date) || b.q.number.localeCompare(a.q.number)
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const ft = calcQuote(form);
  const formTaxLabel = taxLabelFor(form);
  const selectedClient = clients.find((c) => c.id === form.clientId);

  return (
    <>
      <PageHeader
        title="Quotations"
        sub={`${quotes.length} total`}
        action={
          <button
            onClick={openNew}
            className="flex items-center gap-2 h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark shadow-brand transition"
          >
            <Plus className="w-4 h-4" weight="bold" aria-hidden />
            New quote
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          {(
            [
              { key: 'all', label: 'All', count: quotes.length },
              { key: 'draft', label: 'Draft', count: count('draft') },
              { key: 'sent', label: 'Sent', count: count('sent') },
              { key: 'accepted', label: 'Accepted', count: count('accepted') },
              { key: 'declined', label: 'Declined', count: count('declined') },
              { key: 'expired', label: 'Expired', count: count('expired') },
            ] as const
          ).map(({ key, label, count: n }) => {
            const on = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 flex items-center gap-1.5 h-10 pl-4 pr-2 rounded-full text-sm font-semibold transition ${
                  on
                    ? 'bg-brand text-white shadow-brand'
                    : 'bg-surface text-ink-2 shadow-card hover:bg-subtle'
                }`}
              >
                {label}
                <span
                  className={`min-w-6 h-6 px-1.5 flex items-center justify-center text-xs font-semibold rounded-full ${
                    on ? 'bg-white/25 text-white' : 'bg-subtle text-muted'
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by quote #, client, project…"
          className="w-full lg:w-80 shrink-0"
        />
      </div>

      {/* List */}
      {quotes.length === 0 ? (
        <EmptyCard
          icon={<ClipboardText className="w-9 h-9 text-brand" weight="duotone" aria-hidden />}
          title="No quotations yet"
          text="Create your first quote to send to a client."
          action={
            <button
              onClick={openNew}
              className="mt-4 h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition"
            >
              New quote
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyCard
          icon={<MagnifyingGlass className="w-9 h-9 text-brand" weight="duotone" aria-hidden />}
          title="Nothing found"
          text="No quotations match your search or filter."
          action={
            <button
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
              className="mt-3 text-sm font-semibold text-brand hover:underline"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
          {paged.map(({ q, status }) => {
            const client = clients.find((c) => c.id === q.clientId);
            const sc = QUOTE_STATUS_CONFIG[status];
            return (
              <article
                key={q.id}
                className="bg-surface rounded-2xl shadow-card hover:shadow-float transition-shadow flex flex-col"
              >
                <button
                  onClick={() => setViewId(q.id)}
                  className="flex-1 text-left p-4 flex items-start gap-3 rounded-t-2xl active:bg-subtle transition"
                >
                  <span
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${sc.cls}`}
                  >
                    <ClipboardText className="w-5 h-5" weight="duotone" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink truncate">{q.number}</p>
                      <p className="font-semibold text-ink shrink-0 amt">
                        {fmt(calcQuote(q).total)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-sm text-muted truncate">{client?.name ?? '—'}</p>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${sc.cls}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-faint mt-2 flex items-center gap-1 min-w-0">
                      <CalendarBlank
                        className="w-3.5 h-3.5 shrink-0"
                        weight="duotone"
                        aria-hidden
                      />
                      <span className="shrink-0">
                        Valid until {fmtDt(validUntil(q.date, q.validDays))}
                      </span>
                      {q.projectName && <span className="truncate">· {q.projectName}</span>}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
                  <button
                    onClick={() => openEdit(q)}
                    className="h-9 px-4 rounded-full flex items-center gap-1.5 bg-subtle text-sm font-medium text-ink-2 hover:bg-line active:scale-95 transition"
                  >
                    <PencilSimple className="w-4 h-4" weight="duotone" aria-hidden />
                    Edit
                  </button>
                  {status === 'accepted' ? (
                    <button
                      onClick={() => convertToInvoice(q)}
                      disabled={converting === q.id}
                      className={`ml-auto h-9 px-4 rounded-full flex items-center gap-1.5 text-sm font-semibold active:scale-95 transition disabled:opacity-60 ${
                        q.invoiceId
                          ? 'text-brand hover:bg-brand-soft'
                          : 'bg-brand text-white shadow-[0_2px_8px_rgb(0_177_79/0.3)] hover:bg-brand-hover active:bg-brand-dark'
                      }`}
                    >
                      {converting === q.id ? (
                        <CircleNotch className="w-4 h-4 animate-spin" weight="bold" aria-hidden />
                      ) : q.invoiceId ? (
                        <SealCheck className="w-4 h-4" weight="duotone" aria-hidden />
                      ) : (
                        <Receipt className="w-4 h-4" weight="duotone" aria-hidden />
                      )}
                      {q.invoiceId ? 'Invoiced' : 'Convert to invoice'}
                    </button>
                  ) : status === 'declined' ? (
                    <span className="ml-auto h-9 px-3 flex items-center text-sm font-semibold text-red-600">
                      Declined
                    </span>
                  ) : (
                    <button
                      onClick={() => setStatus(q, 'accepted')}
                      className="ml-auto h-9 px-4 rounded-full flex items-center gap-1.5 bg-brand text-white text-sm font-semibold shadow-[0_2px_8px_rgb(0_177_79/0.3)] hover:bg-brand-hover active:bg-brand-dark active:scale-95 transition"
                    >
                      <CheckCircle className="w-4 h-4" weight="duotone" aria-hidden />
                      Accepted
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={PAGE_SIZE}
        onPageChange={goToPage}
      />

      {/* ── Detail sheet ─────────────────────────────────────────────────────── */}
      {viewId &&
        (() => {
          const q = quotes.find((x) => x.id === viewId);
          if (!q) return null;
          const client = clients.find((c) => c.id === q.clientId);
          const status = effectiveQuoteStatus(q, today);
          const sc = QUOTE_STATUS_CONFIG[status];
          const t = calcQuote(q);
          const label = taxLabelFor(q);
          return (
            <ModalShell onClose={() => setViewId(null)}>
              <div className="flex items-start justify-between px-5 py-4 border-b border-line shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-ink">{q.number}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {client?.name ?? '—'}
                    {q.projectName ? ` · ${q.projectName}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setViewId(null)}
                  aria-label="Close"
                  className="p-1.5 rounded-xl text-muted hover:bg-black/[0.04] hover:text-ink transition shrink-0"
                >
                  <X className="w-5 h-5" weight="bold" aria-hidden />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  {q.items.map((it) => (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between py-2 border-b border-line last:border-0 ${it.optional ? 'opacity-60' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">
                          {it.description.split('\n')[0] || '—'}
                          {it.optional && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase text-muted">
                              Optional
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {it.qty} × <span className="amt">{fmt(it.unitPrice)}</span>
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-ink shrink-0 ml-3 amt">
                        {fmt(it.qty * it.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-subtle rounded-2xl p-4 flex flex-col gap-2 text-sm">
                  <Row label="Subtotal" value={fmt(t.subtotal)} />
                  {t.discount > 0 && (
                    <Row
                      label={`Discount (${q.discountPercent}%)`}
                      value={`−${fmt(t.discount)}`}
                      cls="text-amber-600"
                    />
                  )}
                  {q.taxMode !== 'none' && (
                    <Row
                      label={`${label} (${q.taxRate ?? 0}%)`}
                      value={`${q.taxMode === 'vat' ? '+' : '−'}${fmt(t.tax)}`}
                      cls="text-amber-600"
                    />
                  )}
                  <div className="flex justify-between font-bold text-ink border-t border-line pt-2 mt-1">
                    <span>Quoted Total</span>
                    <span className="amt">{fmt(t.total)}</span>
                  </div>
                  {t.deposit != null && (
                    <Row label="Deposit to start" value={fmt(t.deposit)} cls="text-brand" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted mb-0.5">Date</p>
                    <p className="text-ink">{fmtDt(q.date)}</p>
                  </div>
                  <div>
                    <p className="text-muted mb-0.5">Valid until</p>
                    <p className="text-ink">{fmtDt(validUntil(q.date, q.validDays))}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-ink mb-2">Change Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['draft', 'sent', 'accepted', 'declined'] as QuotationStatus[]).map((s) => {
                      const conf = QUOTE_STATUS_CONFIG[s];
                      const active = (q.status ?? 'draft') === s;
                      return (
                        <button
                          key={s}
                          disabled={active}
                          onClick={() => setStatus(q, s, () => setViewId(null))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${active ? conf.cls + ' ring-1 ring-line-strong cursor-default' : 'bg-subtle text-muted hover:bg-black/[0.04] active:bg-black/[0.07]'}`}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                  {status === 'expired' && (
                    <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                      <HourglassMedium className="w-3.5 h-3.5" weight="duotone" aria-hidden />
                      Past its valid-until date. Edit the date or validity to reopen it.
                    </p>
                  )}
                </div>
              </div>

              <div className="px-5 py-4 border-t border-line shrink-0 flex flex-col gap-2">
                {status === 'accepted' && (
                  <button
                    onClick={() => {
                      setViewId(null);
                      convertToInvoice(q);
                    }}
                    disabled={converting === q.id}
                    className="h-11 w-full flex items-center justify-center gap-2 rounded-full bg-brand text-white text-sm font-semibold shadow-brand hover:bg-brand-hover active:bg-brand-dark transition disabled:opacity-60"
                  >
                    <Receipt className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                    {q.invoiceId && invoices.some((i) => i.id === q.invoiceId)
                      ? `Open invoice ${invoices.find((i) => i.id === q.invoiceId)?.number}`
                      : 'Convert to invoice'}
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setViewId(null);
                      openEdit(q);
                    }}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-full border border-line-strong text-ink-2 text-sm font-medium hover:bg-black/[0.04] transition"
                  >
                    <PencilSimple className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                    Edit
                  </button>
                  <a
                    href={`/quotations/${q.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-full bg-brand-soft border border-brand/40 text-brand text-sm font-semibold hover:bg-brand/15 transition"
                  >
                    <Printer className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                    PDF
                  </a>
                  <button
                    onClick={() => sendToTelegram(q)}
                    disabled={sendingTelegram === q.id}
                    className="h-11 px-3.5 flex items-center justify-center rounded-full border border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100 transition disabled:opacity-50"
                    title="Send to Telegram"
                    aria-label="Send to Telegram"
                  >
                    {sendingTelegram === q.id ? (
                      <CircleNotch className="w-4 h-4 animate-spin" weight="bold" aria-hidden />
                    ) : (
                      <TelegramLogo className="w-4 h-4" weight="duotone" aria-hidden />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setViewId(null);
                    setDeleteId(q.id);
                  }}
                  className="h-10 w-full flex items-center justify-center gap-2 rounded-full border border-red-200 text-red-600 text-sm hover:bg-red-100 transition"
                >
                  <Trash className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                  Delete Quotation
                </button>
              </div>
            </ModalShell>
          );
        })()}

      {/* ── Form panel ───────────────────────────────────────────────────────── */}
      {panelOpen && (
        <ModalShell onClose={closePanel} maxWidth="max-w-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
            <h2 className="text-lg font-bold text-ink">
              {editingId ? 'Edit quotation' : 'New quotation'}
            </h2>
            <button
              onClick={closePanel}
              aria-label="Close"
              className="text-muted hover:text-ink transition p-1"
            >
              <X className="w-5 h-5" weight="bold" aria-hidden />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PanelField label="Quote Number" required>
                <input
                  value={form.number}
                  onChange={(e) => setField('number', e.target.value)}
                  className={inputCls}
                  placeholder="QT-2026-001"
                />
              </PanelField>
              <PanelField label="Date" required>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setField('date', e.target.value)}
                  className={inputCls}
                />
              </PanelField>
              <PanelField label="Valid for (days)" required>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.validDays || ''}
                  onChange={(e) => setField('validDays', parseInt(e.target.value) || 0)}
                  className={inputCls}
                />
              </PanelField>
            </div>
            {form.date && form.validDays > 0 && (
              <p className="-mt-4 text-xs text-muted">
                Valid until {fmtDt(validUntil(form.date, form.validDays))}
              </p>
            )}

            {/* Client */}
            <PanelField label="Client" required>
              <div className="relative">
                {(() => {
                  const needle = clientSearch.toLowerCase().trim();
                  const list = needle
                    ? clients.filter((c) =>
                        [
                          c.name,
                          c.contactPerson ?? '',
                          c.phone,
                          c.email,
                          c.address,
                          c.note ?? '',
                        ].some((f) => f.toLowerCase().includes(needle))
                      )
                    : clients;
                  return (
                    <>
                      <input
                        value={clientDropOpen ? clientSearch : (selectedClient?.name ?? '')}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setClientDropOpen(true);
                          if (!e.target.value) setField('clientId', '');
                        }}
                        onFocus={() => {
                          setClientSearch('');
                          setClientDropOpen(true);
                        }}
                        onBlur={() => setTimeout(() => setClientDropOpen(false), 150)}
                        placeholder="Search clients…"
                        className={inputCls}
                      />
                      {clientDropOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface shadow-float">
                          {list.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted">No clients found</div>
                          ) : (
                            list.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onMouseDown={() => {
                                  setField('clientId', c.id);
                                  setClientSearch('');
                                  setClientDropOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-black/[0.04] transition ${form.clientId === c.id ? 'bg-brand-soft' : ''}`}
                              >
                                <div className="text-sm font-medium text-ink">{c.name}</div>
                                {(c.contactPerson || c.email || c.phone) && (
                                  <div className="text-xs text-muted truncate">
                                    {[c.contactPerson, c.email, c.phone]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </div>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </PanelField>

            <PanelField label="Project / Campaign Name" required>
              <input
                value={form.projectName ?? ''}
                onChange={(e) => setField('projectName', e.target.value)}
                placeholder="Campaign or event name…"
                className={inputCls}
              />
            </PanelField>

            {paymentMethods.length > 0 && (
              <PanelField label="Payment Method">
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((m) => {
                    const active = form.paymentMethodId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setField('paymentMethodId', m.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? 'bg-brand-soft border-brand text-brand' : 'border-line-strong text-muted hover:bg-black/[0.04]'}`}
                      >
                        {m.label}
                        {m.isDefault && !active && (
                          <span className="ml-1 opacity-50">(default)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </PanelField>
            )}

            <PanelField label="Status">
              <div className="flex gap-2 flex-wrap">
                {(['draft', 'sent', 'accepted', 'declined'] as QuotationStatus[]).map((s) => {
                  const active = form.status === s;
                  const conf = QUOTE_STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setField('status', s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? `${conf.cls} border-current` : 'border-line-strong text-muted hover:bg-black/[0.04]'}`}
                    >
                      {conf.label}
                    </button>
                  );
                })}
              </div>
            </PanelField>

            <PanelField label="Intro message">
              <textarea
                rows={5}
                value={form.intro ?? ''}
                onChange={(e) => setField('intro', e.target.value)}
                className={textareaCls}
              />
              <p className="text-xs text-faint">
                Use {'{contact}'}, {'{client}'}, {'{project}'}, {'{company}'}. Leave a blank line
                for a new paragraph. Clear it to hide the intro.
              </p>
            </PanelField>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-ink-2">Line Items</span>
                <button
                  onClick={() => setField('items', [...form.items, emptyItem()])}
                  className="flex items-center gap-1 text-xs text-muted hover:text-ink transition"
                >
                  <Plus className="w-3.5 h-3.5" weight="bold" aria-hidden />
                  Add row
                </button>
              </div>
              <div className="rounded-xl border border-line overflow-hidden divide-y divide-line">
                {form.items.map((item) => {
                  const nlIdx = item.description.indexOf('\n');
                  const title = nlIdx === -1 ? item.description : item.description.slice(0, nlIdx);
                  const scope = nlIdx === -1 ? '' : item.description.slice(nlIdx + 1);
                  const scopeLines = scope
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const setTitle = (v: string) =>
                    updateItem(item.id, { description: v + (scope ? '\n' + scope : '') });
                  const addScopeLine = (line: string) => {
                    const trimmed = line.trim();
                    if (!trimmed || scopeLines.includes(trimmed)) return;
                    updateItem(item.id, {
                      description: title + '\n' + [...scopeLines, trimmed].join('\n'),
                    });
                  };
                  const removeScopeLine = (line: string) => {
                    const next = scopeLines.filter((s) => s !== line).join('\n');
                    updateItem(item.id, { description: title + (next ? '\n' + next : '') });
                  };
                  const customVal = customScope[item.id] ?? '';
                  return (
                    <div key={item.id} className="bg-surface">
                      <div className="flex items-center gap-2 pr-2">
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={form.projectName || 'Project / event title…'}
                          className="flex-1 min-w-0 px-3 pt-2.5 pb-2 text-sm font-medium text-ink placeholder:text-faint focus:outline-none bg-transparent"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, { optional: item.optional ? undefined : true })
                          }
                          title="Optional items show on the quote but are not added to the total"
                          className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition ${item.optional ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-line-strong text-muted hover:bg-black/[0.04]'}`}
                        >
                          Optional
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={form.items.length === 1}
                          aria-label="Remove item"
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-faint hover:text-red-600 hover:bg-red-100 disabled:opacity-0 transition"
                        >
                          <X className="w-3.5 h-3.5" weight="bold" aria-hidden />
                        </button>
                      </div>
                      <div className="px-3 pb-2.5 border-t border-line">
                        {scopeLines.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2 pb-1.5">
                            {scopeLines.map((line) => (
                              <span
                                key={line}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand text-white text-xs font-bold"
                              >
                                {line}
                                <button
                                  type="button"
                                  onClick={() => removeScopeLine(line)}
                                  aria-label={`Remove ${line}`}
                                  className="ml-0.5 text-white/80 hover:text-white transition"
                                >
                                  <X className="w-2.5 h-2.5" weight="bold" aria-hidden />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {scopeOfWork.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {scopeOfWork
                              .filter((s) => !scopeLines.includes(s))
                              .map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => addScopeLine(sug)}
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-subtle text-muted text-xs hover:bg-black/[0.04] hover:text-ink transition"
                                >
                                  <Plus className="w-2.5 h-2.5" weight="bold" aria-hidden />
                                  {sug}
                                </button>
                              ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <input
                            value={customVal}
                            onChange={(e) =>
                              setCustomScope((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addScopeLine(customVal);
                                setCustomScope((prev) => ({ ...prev, [item.id]: '' }));
                              }
                            }}
                            placeholder="Custom scope… (Enter to add)"
                            className="flex-1 h-6 text-xs text-muted placeholder:text-faint focus:outline-none bg-transparent"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5 border-t border-line bg-black/5">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted">Qty</span>
                          <input
                            type="number"
                            min={0}
                            value={item.qty === 0 ? '' : item.qty}
                            onChange={(e) =>
                              updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })
                            }
                            className="w-14 h-8 rounded-lg border border-line-strong bg-subtle px-2 text-sm text-center text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                          />
                        </div>
                        <span className="text-faint text-sm">×</span>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xs text-muted">{prefs.currencySymbol}</span>
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            onChange={(e) =>
                              updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                            }
                            className="flex-1 min-w-0 h-8 rounded-lg border border-line-strong bg-subtle px-2 text-sm text-right text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                          />
                        </div>
                        <span
                          className={`text-sm font-semibold shrink-0 ${item.optional ? 'text-faint' : 'text-ink-2'}`}
                        >
                          {fmt(item.qty * item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Discount + tax */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PanelField label="Discount %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  value={form.discountPercent ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setField('discountPercent', isNaN(v) || v <= 0 ? undefined : Math.min(100, v));
                  }}
                  placeholder="0"
                  className={inputCls}
                />
              </PanelField>
              <PanelField label="Tax">
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-subtle border border-line">
                  {(
                    [
                      ['none', 'None'],
                      ['vat', 'VAT +'],
                      ['wht', 'WHT −'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTaxMode(mode)}
                      className={`h-9 rounded-lg text-sm font-semibold transition ${form.taxMode === mode ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </PanelField>
            </div>
            {form.taxMode === 'none' ? (
              <PanelField label="Note under the total">
                <input
                  value={form.taxNote ?? ''}
                  onChange={(e) => setField('taxNote', e.target.value)}
                  placeholder="All prices exclude VAT and other applicable taxes."
                  className={inputCls}
                />
              </PanelField>
            ) : (
              <div className="grid grid-cols-2 gap-4 -mt-2">
                <PanelField label="Tax label">
                  <input
                    value={form.taxLabel ?? ''}
                    onChange={(e) => setField('taxLabel', e.target.value)}
                    placeholder={form.taxMode === 'vat' ? 'VAT' : 'WHT'}
                    className={inputCls}
                  />
                </PanelField>
                <PanelField label="Rate %">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    inputMode="decimal"
                    value={form.taxRate ?? ''}
                    onChange={(e) => setField('taxRate', parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </PanelField>
              </div>
            )}

            {/* Deposit */}
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-brand-soft border border-brand/30">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand">Deposit to start</p>
                  <p className="text-xs text-brand mt-0.5">
                    Shown under the total and in the payment info.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.depositMode != null}
                  aria-label="Deposit to start"
                  onClick={() =>
                    setForm((prev) =>
                      prev.depositMode
                        ? { ...prev, depositMode: undefined, depositValue: undefined }
                        : {
                            ...prev,
                            depositMode: 'percent',
                            depositValue: quoteDefaults.depositPercent || 50,
                          }
                    )
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.depositMode ? 'bg-green-500' : 'bg-zinc-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.depositMode ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              {form.depositMode && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex p-0.5 rounded-lg bg-surface border border-brand/30">
                    {(
                      [
                        ['percent', '%'],
                        ['amount', prefs.currencySymbol || '$'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            depositMode: mode,
                            depositValue:
                              mode === 'percent'
                                ? quoteDefaults.depositPercent || 50
                                : Math.round(ft.total / 2),
                          }))
                        }
                        className={`h-8 min-w-10 px-3 rounded-md text-sm font-semibold transition ${form.depositMode === mode ? 'bg-brand text-white' : 'text-brand'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={form.depositValue ?? ''}
                    onChange={(e) => setField('depositValue', parseFloat(e.target.value) || 0)}
                    aria-label={
                      form.depositMode === 'percent' ? 'Deposit percent' : 'Deposit amount'
                    }
                    className="w-28 h-9 rounded-xl border border-brand/30 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green-400 bg-surface text-right"
                  />
                  <span className="text-sm text-brand">= {fmt(ft.deposit ?? 0)}</span>
                </div>
              )}
            </div>

            {/* Totals summary */}
            <div className="flex flex-col items-end gap-1.5 text-sm">
              <SumRow label="Subtotal" value={fmt(ft.subtotal)} />
              {ft.discount > 0 && (
                <SumRow
                  label={`Discount (${form.discountPercent}%)`}
                  value={`(${fmt(ft.discount)})`}
                  cls="text-orange-600"
                />
              )}
              {form.taxMode !== 'none' && (
                <SumRow
                  label={`${form.taxMode === 'vat' ? 'Add' : 'Less'} ${formTaxLabel} ${form.taxRate ?? 0}%`}
                  value={form.taxMode === 'vat' ? fmt(ft.tax) : `(${fmt(ft.tax)})`}
                  cls="text-orange-600"
                />
              )}
              <div className="flex gap-8 pt-1.5 border-t border-line">
                <span className="font-semibold text-ink-2">Quoted Total</span>
                <span className="font-bold text-ink w-28 text-right">{fmt(ft.total)}</span>
              </div>
              {ft.optionalTotal > 0 && (
                <SumRow
                  label="Optional add-ons (not counted)"
                  value={fmt(ft.optionalTotal)}
                  cls="text-faint"
                />
              )}
            </div>

            {selectedClient?.vat_tin && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-700">Show VAT TIN on Quotation</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Display the client&apos;s VAT TIN in the Prepared For section.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!form.showVatTin}
                  aria-label="Show VAT TIN"
                  onClick={() => setField('showVatTin', form.showVatTin ? undefined : true)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.showVatTin ? 'bg-blue-500' : 'bg-zinc-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.showVatTin ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}

            <PanelField label="Equipment & gear">
              <textarea
                rows={4}
                value={form.gear ?? ''}
                onChange={(e) => setField('gear', e.target.value)}
                placeholder={'Sony FX3 cinema camera ×2\nDJI RS 4 Pro gimbal'}
                className={textareaCls}
              />
              <p className="text-xs text-faint">One item per line. Leave empty to hide.</p>
            </PanelField>

            <PanelField label="Terms & conditions">
              <textarea
                rows={4}
                value={form.terms ?? ''}
                onChange={(e) => setField('terms', e.target.value)}
                className={textareaCls}
              />
              <p className="text-xs text-faint">One term per line. Leave empty to hide.</p>
            </PanelField>

            <PanelField label="Usage rights">
              <textarea
                rows={4}
                value={form.usageRights ?? ''}
                onChange={(e) => setField('usageRights', e.target.value)}
                className={textareaCls}
              />
              <p className="text-xs text-faint">
                Wrap words in **double stars** to make them bold. Leave empty to hide.
              </p>
            </PanelField>

            <PanelField label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className={textareaCls}
                placeholder="Shooting dates, client-provided materials…"
              />
            </PanelField>
          </div>

          <div
            className="px-6 py-4 border-t border-line flex flex-col gap-3 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={closePanel}
                className="h-11 px-4 rounded-xl border border-line-strong bg-subtle text-sm text-ink hover:bg-black/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndPreview}
                disabled={isPending}
                className="flex h-11 px-4 rounded-xl border border-line-strong bg-subtle text-sm text-ink hover:bg-black/[0.04] transition items-center gap-2 disabled:opacity-60"
              >
                <Eye className="w-4 h-4" weight="duotone" aria-hidden />
                Save & Preview
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition disabled:opacity-60"
              >
                {editingId ? 'Save changes' : 'Create quote'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteId && (
        <ConfirmDeleteModal
          title="Delete quotation?"
          onConfirm={() =>
            startTransition(async () => {
              await deleteQuote(deleteId);
              setDeleteId(null);
            })
          }
          onClose={() => setDeleteId(null)}
        />
      )}
    </>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className={`flex justify-between ${cls ?? ''}`}>
      <span className={cls ? '' : 'text-muted'}>{label}</span>
      <span className={`font-medium amt ${cls ? '' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

function SumRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className={`flex gap-8 ${cls ?? 'text-ink-2'}`}>
      <span>{label}</span>
      <span className="font-medium w-28 text-right">{value}</span>
    </div>
  );
}

function PanelField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-2">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
