'use client';

import {
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  Eye,
  LockSimple,
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
import { createRoot } from 'react-dom/client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sheet } from '@/src/components/InvoicePrint';
import {
  type Invoice,
  type LineItem,
  type InvoiceStatus,
  type CompanyProfile,
  type PaymentInfo,
  type PaymentMethod,
} from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import {
  useCompanyProfile,
  usePaymentInfo,
  usePaymentMethods,
  useInvoicingSettings,
  useScopeOfWork,
} from '@/src/hooks/useSettings';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { calcSubtotal, calcTaxAmount, calcNet, taxConfigFromPrefs } from '@/src/lib/calculations';
import { useAppPreferences, useCurrency, useDateFmt } from '@/src/hooks/useAppPreferences';
import { uid } from '@/src/lib/id';
import { PAYMENT_TERMS, PAGE_SIZE, STORAGE_KEYS } from '@/src/config/constants';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import { PageHeader, EmptyCard } from '@/src/components/PageHeader';
import ModalShell from '@/src/components/ModalShell';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';
import { useInvoiceMutations } from '@/src/hooks/useInvoices';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const max = invoices.reduce((m, inv) => {
    if (!inv.number.startsWith(prefix)) return m;
    const n = parseInt(inv.number.slice(prefix.length), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function emptyItem(): LineItem {
  return { id: uid(), description: '', qty: 1, unitPrice: 0 };
}

type FormState = Omit<Invoice, 'id'>;

const inputCls =
  'h-11 rounded-xl border border-line bg-subtle px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand focus:bg-surface transition w-full';

export default function InvoicesScreen() {
  const { data: clients, isLoading } = useClients();
  const { data: invoices } = useInvoices();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: companyProfile } = useCompanyProfile();
  const { data: paymentInfo } = usePaymentInfo();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: invoicingSettings } = useInvoicingSettings();
  const prefs = useAppPreferences();
  const { fmtAmount: fmt } = useCurrency();
  const fmtDt = useDateFmt();
  const taxConfig = taxConfigFromPrefs(prefs);

  const [isPending, startTransition] = useTransition();
  const { upsert: upsertInvoice, remove: deleteInvoice } = useInvoiceMutations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const didAutoOpen = useRef(false);

  // ── Telegram ───────────────────────────────────────────────────────────────
  const [sendingTelegram, setSendingTelegram] = useState<string | null>(null);

  function resolvePayment(inv: Invoice): PaymentInfo {
    const method: PaymentMethod | undefined = inv.paymentMethodId
      ? paymentMethods.find((m) => m.id === inv.paymentMethodId)
      : paymentMethods.find((m) => m.isDefault);
    if (method) {
      return {
        ...(paymentInfo ?? {}),
        bankName: method.bankName,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        swiftCode: method.swiftCode,
        currency: method.currency,
        qrImage: method.qrImage,
      } as PaymentInfo;
    }
    return {
      ...(paymentInfo ?? {}),
      bankName: invoicingSettings?.bankName ?? '',
      accountName: invoicingSettings?.accountName ?? '',
      accountNumber: invoicingSettings?.accountNumber ?? '',
      swiftCode: invoicingSettings?.swiftCode ?? '',
      currency: invoicingSettings?.currency ?? '',
      qrImage: invoicingSettings?.qrImage ?? '',
    } as PaymentInfo;
  }

  async function generatePdfBlob(inv: Invoice): Promise<Blob> {
    const [html2canvas, { default: jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ]);

    const client = clients.find((c) => c.id === inv.clientId) ?? null;
    const subtotal = inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const whtAmount = calcTaxAmount(inv, taxConfig);
    const netTotal = calcNet(inv, taxConfig);
    const depositAmount = inv.depositPercent != null ? netTotal * (inv.depositPercent / 100) : null;
    const balanceDue = depositAmount != null ? netTotal - depositAmount : null;

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
    document.body.appendChild(container);

    const root = createRoot(container);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(Sheet, {
          invoice: inv,
          client,
          company: companyProfile ?? ({} as CompanyProfile),
          payment: resolvePayment(inv),
          subtotal,
          whtAmount,
          netTotal,
          depositAmount,
          balanceDue,
          taxLabel: taxConfig.label,
          taxRate: taxConfig.rate,
          taxType: taxConfig.type,
          currencyCode: prefs.currencyCode,
        })
      );
      setTimeout(resolve, 900);
    });

    const sheetEl = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(sheetEl, { useCORS: true, scale: 2.5, logging: false });

    root.unmount();
    document.body.removeChild(container);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfW = 210;
    const pdfH = (canvas.height / canvas.width) * pdfW;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);

    return pdf.output('blob');
  }

  async function sendToTelegram(inv: Invoice) {
    const token = paymentInfo?.telegramBotToken?.trim();
    const chatId = paymentInfo?.telegramChatId?.trim();
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSendingTelegram(inv.id);
    try {
      const client = clients.find((c) => c.id === inv.clientId);
      const pdfBlob = await generatePdfBlob(inv);

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', pdfBlob, `${inv.number}.pdf`);
      formData.append(
        'caption',
        [`📄 *${inv.number}*`, `📅 Date: ${inv.date}`, `👤 Client: ${client?.name ?? '—'}`].join(
          '\n'
        )
      );
      formData.append('parse_mode', 'Markdown');
      if (paymentInfo?.telegramTopicId?.trim()) {
        formData.append('message_thread_id', paymentInfo.telegramTopicId.trim());
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(`Telegram error: ${err.description ?? res.statusText}`);
      }
    } catch (e) {
      toast.error(`Failed to send: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSendingTelegram(null);
    }
  }

  // ── Invoice form panel ─────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [customScope, setCustomScope] = useState<Record<string, string>>({});

  const blankForm = (): FormState => ({
    number: nextInvoiceNumber(invoices),
    date: localToday(),
    paymentTerms: 'Due on receipt',
    status: 'draft',
    clientId: '',
    projectName: '',
    items: [emptyItem()],
    notes: '',
    depositPercent: undefined,
    withWHT: undefined,
    showVatTin: undefined,
    paymentMethodId: paymentMethods.find((m) => m.isDefault)?.id,
  });

  const [form, setForm] = useState<FormState>(blankForm);

  // Client combobox
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  function openNew() {
    setEditingId(null);
    setForm(blankForm());
    setFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setPanelOpen(true);
  }

  useEffect(() => {
    if (didAutoOpen.current) return;
    if (searchParams.get('new') === '1') {
      didAutoOpen.current = true;

      openNew();
      router.replace('/invoices');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  function openEdit(inv: Invoice) {
    setEditingId(inv.id);
    setForm({
      number: inv.number,
      date: inv.date,
      paymentTerms: inv.paymentTerms ?? 'Due on receipt',
      status: inv.status ?? 'draft',
      clientId: inv.clientId,
      projectName: inv.projectName ?? '',
      items: inv.items,
      notes: inv.notes,
      depositPercent: inv.depositPercent,
      withWHT: inv.withWHT,
      showVatTin: inv.showVatTin,
      paymentMethodId: inv.paymentMethodId ?? paymentMethods.find((m) => m.isDefault)?.id,
    });
    setFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
    setFormError('');
    setClientSearch('');
    setClientDropOpen(false);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function addItem() {
    setField('items', [...form.items, emptyItem()]);
  }
  function removeItem(id: string) {
    if (form.items.length > 1)
      setField(
        'items',
        form.items.filter((it) => it.id !== id)
      );
  }
  function updateItem(id: string, patch: Partial<LineItem>) {
    setField(
      'items',
      form.items.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  function validateForm(): string | null {
    if (!form.projectName?.trim()) return 'Project / Campaign Name is required.';
    if (!form.clientId) return 'Please select a client.';
    if (!form.number.trim()) return 'Invoice number is required.';
    const duplicate = invoices.find(
      (inv) => inv.number === form.number.trim() && inv.id !== editingId
    );
    if (duplicate) return `Invoice number "${form.number.trim()}" is already used.`;
    if (form.items.some((it) => !it.description.trim()))
      return 'All line items need a description.';
    return null;
  }

  async function performSave(invoiceId: string) {
    await upsertInvoice({ id: invoiceId, ...form });
  }

  function handleSave() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    const invoiceId = editingId ?? uid();
    startTransition(async () => {
      await performSave(invoiceId);
      closePanel();
    });
  }

  function handleSaveAndPreview() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    const invoiceId = editingId ?? uid();
    const win = window.open('', '_blank');
    startTransition(async () => {
      await performSave(invoiceId);
      if (win) win.location.href = `/invoices/${invoiceId}`;
    });
  }

  const subtotal = form.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const formTaxAmount = calcTaxAmount(form as Parameters<typeof calcTaxAmount>[0], taxConfig) ?? 0;
  const whtAmount = formTaxAmount;
  const netTotal = calcNet(form as Parameters<typeof calcNet>[0], taxConfig);
  const depositAmount = form.depositPercent != null ? netTotal * (form.depositPercent / 100) : 0;
  const balanceDue = netTotal - depositAmount;

  const taxRate = taxConfig.enabled ? taxConfig.rate / 100 : 0.15;

  function toggleWHT() {
    setForm((prev) => {
      const enabling = !prev.withWHT;
      return {
        ...prev,
        withWHT: enabling || undefined,
        items: prev.items.map((it) => ({
          ...it,
          unitPrice: enabling
            ? Math.round((it.unitPrice / (1 - taxRate)) * 100) / 100
            : Math.round(it.unitPrice * (1 - taxRate) * 100) / 100,
        })),
      };
    });
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewInvId, setViewInvId] = useState<string | null>(null);

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteInvoice(id);
      setDeleteId(null);
    });
  }

  // ── Filter / sort / paginate ───────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all' | 'active'>('all');

  type InvSortCol = 'number' | 'date' | 'amount';
  const [sortCol] = useState<InvSortCol>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEYS.tableInvCol) as InvSortCol) ?? 'number')
      : 'number'
  );
  const [sortDir] = useState<'asc' | 'desc'>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEYS.tableInvDir) as 'asc' | 'desc') ?? 'asc')
      : 'asc'
  );
  const [page, setPage] = useState<number>(() =>
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem(STORAGE_KEYS.tableInvPage) ?? '1') || 1
      : 1
  );

  const [prevSearch, setPrevSearch] = useState(search);
  const [prevStatusFilter, setPrevStatusFilter] = useState(statusFilter);

  if (isLoading) return <TablePageSkeleton />;

  if (prevSearch !== search || prevStatusFilter !== statusFilter) {
    setPrevSearch(search);
    setPrevStatusFilter(statusFilter);
    setPage(1);
    localStorage.setItem(STORAGE_KEYS.tableInvPage, '1');
  }

  function goToPage(p: number) {
    setPage(p);
    localStorage.setItem(STORAGE_KEYS.tableInvPage, String(p));
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'all' && inv.status === 'paid') return false;
    if (statusFilter === 'active' && inv.status !== 'sent' && inv.status !== 'partial')
      return false;
    if (statusFilter !== 'all' && statusFilter !== 'active' && inv.status !== statusFilter)
      return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const client = clients.find((c) => c.id === inv.clientId);
      if (
        ![inv.number, client?.name ?? '', fmt(calcSubtotal(inv)), inv.status]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
        return false;
    }
    return true;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (statusFilter === 'paid') return b.date.localeCompare(a.date);
    let cmp = 0;
    if (sortCol === 'number') {
      const n = (s: string) =>
        parseInt(s.split('-').pop() ?? '0') + s.split('-').slice(0, -1).join('');
      cmp = n(a.number) < n(b.number) ? -1 : n(a.number) > n(b.number) ? 1 : 0;
    } else if (sortCol === 'date') {
      cmp = a.date.localeCompare(b.date);
    } else if (sortCol === 'amount') {
      cmp = calcSubtotal(a) - calcSubtotal(b);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedInvoices = sortedInvoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      {/* Header */}
      <PageHeader
        title="Invoices"
        sub={`${invoices.length} total`}
        action={
          <button
            onClick={openNew}
            className="flex items-center gap-2 h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark shadow-brand transition"
          >
            <Plus className="w-4 h-4" weight="bold" aria-hidden />
            New invoice
          </button>
        }
      />

      {/* Filters: chips scroll sideways on phones, search sits beside them on iPad+ */}
      <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          {(
            [
              {
                key: 'all',
                label: 'All',
                count: invoices.filter((i) => i.status !== 'paid').length,
              },
              {
                key: 'draft',
                label: 'Draft',
                count: invoices.filter((i) => i.status === 'draft').length,
              },
              {
                key: 'active',
                label: 'Active',
                count: invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length,
              },
              {
                key: 'partial',
                label: 'Deposit',
                count: invoices.filter((i) => i.status === 'partial').length,
              },
              {
                key: 'overdue',
                label: 'Late',
                count: invoices.filter((i) => i.status === 'overdue').length,
              },
              {
                key: 'paid',
                label: 'Paid',
                count: invoices.filter((i) => i.status === 'paid').length,
              },
            ] as const
          ).map(({ key, label, count }) => {
            const on = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
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
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice #, client, amount…"
          className="w-full lg:w-80 shrink-0"
        />
      </div>

      {/* Empty states */}
      {invoices.length === 0 ? (
        <EmptyCard
          icon={<Receipt className="w-9 h-9 text-brand" weight="duotone" aria-hidden />}
          title="No invoices yet"
          text="Create your first invoice to get paid."
          action={
            <button
              onClick={openNew}
              className="mt-4 h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition"
            >
              New invoice
            </button>
          }
        />
      ) : filteredInvoices.length === 0 ? (
        <EmptyCard
          icon={<MagnifyingGlass className="w-9 h-9 text-brand" weight="duotone" aria-hidden />}
          title="Nothing found"
          text="No invoices match your search or filter."
          action={
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-3 text-sm font-semibold text-brand hover:underline"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
          {pagedInvoices.map((inv) => {
            const client = clients.find((c) => c.id === inv.clientId);
            const sub = calcSubtotal(inv);
            const status = (inv.status ?? 'draft') as InvoiceStatus;
            const sc = STATUS_CONFIG[status];
            return (
              <article
                key={inv.id}
                className="bg-surface rounded-2xl shadow-card hover:shadow-float transition-shadow flex flex-col"
              >
                <button
                  onClick={() => setViewInvId(inv.id)}
                  className="flex-1 text-left p-4 flex items-start gap-3 rounded-t-2xl active:bg-subtle transition"
                >
                  <span
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${sc.cls}`}
                  >
                    <Receipt className="w-5 h-5" weight="duotone" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink truncate">{inv.number}</p>
                      <p className="font-semibold text-ink shrink-0 amt">{fmt(sub)}</p>
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
                      <span className="shrink-0">{fmtDt(inv.date)}</span>
                      {inv.projectName && <span className="truncate">· {inv.projectName}</span>}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
                  <button
                    onClick={() => openEdit(inv)}
                    className="h-9 px-4 rounded-full flex items-center gap-1.5 bg-subtle text-sm font-medium text-ink-2 hover:bg-line active:scale-95 transition"
                  >
                    <PencilSimple className="w-4 h-4" weight="duotone" aria-hidden />
                    Edit
                  </button>
                  {status !== 'paid' ? (
                    <button
                      onClick={() =>
                        startTransition(() => upsertInvoice({ ...inv, status: 'paid' }))
                      }
                      className="ml-auto h-9 px-4 rounded-full flex items-center gap-1.5 bg-brand text-white text-sm font-semibold shadow-[0_2px_8px_rgb(0_177_79/0.3)] hover:bg-brand-hover active:bg-brand-dark active:scale-95 transition"
                    >
                      <CheckCircle className="w-4 h-4" weight="duotone" aria-hidden />
                      Mark paid
                    </button>
                  ) : (
                    <span className="ml-auto h-9 px-3 flex items-center gap-1.5 text-sm font-semibold text-brand">
                      <SealCheck className="w-4 h-4" weight="duotone" aria-hidden />
                      Paid
                    </span>
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
        totalItems={sortedInvoices.length}
        pageSize={PAGE_SIZE}
        onPageChange={goToPage}
      />

      {/* ── Invoice detail sheet ────────────────────────────────────────────────── */}
      {viewInvId &&
        (() => {
          const inv = invoices.find((i) => i.id === viewInvId);
          if (!inv) return null;
          const client = clients.find((c) => c.id === inv.clientId);
          const sc = STATUS_CONFIG[(inv.status ?? 'draft') as InvoiceStatus];
          const sub = calcSubtotal(inv);
          const wht = calcTaxAmount(inv, taxConfig);
          const net = calcNet(inv, taxConfig);
          const dep = inv.depositPercent != null ? net * (inv.depositPercent / 100) : null;
          const bal = dep != null ? net - dep : null;

          return (
            <ModalShell onClose={() => setViewInvId(null)}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-line shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-ink">{inv.number}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{client?.name ?? '—'}</p>
                </div>
                <button
                  onClick={() => setViewInvId(null)}
                  className="p-1.5 rounded-xl text-muted hover:bg-black/[0.04] hover:text-ink transition shrink-0"
                >
                  <X className="w-5 h-5" weight="bold" aria-hidden />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                {/* Line items */}
                <div className="flex flex-col gap-1">
                  {inv.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between py-2 border-b border-line last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{it.description || '—'}</p>
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

                {/* Totals */}
                <div className="bg-subtle rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal</span>
                    <span className="font-medium text-ink amt">{fmt(sub)}</span>
                  </div>
                  {wht != null && (
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>
                        {taxConfig.enabled ? taxConfig.label : 'WHT'} (
                        {taxConfig.enabled ? taxConfig.rate : 15}%)
                      </span>
                      <span className="font-medium">
                        {taxConfig.type === 'additive' ? '+' : '−'}
                        <span className="amt">{fmt(wht)}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-ink border-t border-line pt-2 mt-1">
                    <span>Net Total</span>
                    <span className="amt">{fmt(net)}</span>
                  </div>
                  {dep != null && (
                    <>
                      <div className="flex justify-between text-sm text-brand">
                        <span>Deposit ({inv.depositPercent}%)</span>
                        <span className="amt">{fmt(dep)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold text-ink-2">
                        <span>Balance Due</span>
                        <span className="amt">{fmt(bal ?? 0)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted mb-0.5">Date</p>
                    <p className="text-ink">{fmtDt(inv.date)}</p>
                  </div>
                  <div>
                    <p className="text-muted mb-0.5">Terms</p>
                    <p className="text-ink">{inv.paymentTerms || '—'}</p>
                  </div>
                </div>

                {/* Linked projects */}

                {/* Status change */}
                <div>
                  <p className="text-sm font-semibold text-ink mb-2">Change Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['draft', 'sent', 'partial', 'paid', 'overdue'] as InvoiceStatus[]).map(
                      (s) => {
                        const sconf = STATUS_CONFIG[s];
                        const isActive = (inv.status ?? 'draft') === s;
                        return (
                          <button
                            key={s}
                            disabled={isActive}
                            onClick={() => {
                              startTransition(async () => {
                                await upsertInvoice({ ...inv, status: s });
                                setViewInvId(null);
                              });
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${isActive ? sconf.cls + ' ring-1 ring-line-strong cursor-default' : 'bg-subtle text-muted hover:bg-black/[0.04] active:bg-black/[0.07]'}`}
                          >
                            {sconf.label}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Action footer */}
              <div className="px-5 py-4 border-t border-line shrink-0 flex flex-col gap-2">
                {/* Row 1: Edit + PDF + Telegram */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setViewInvId(null);
                      openEdit(inv);
                    }}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-full border border-line-strong text-ink-2 text-sm font-medium hover:bg-black/[0.04] transition"
                  >
                    <PencilSimple className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                    Edit
                  </button>
                  <a
                    href={`/invoices/${inv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-full bg-brand-soft border border-brand/40 text-brand text-sm font-semibold hover:bg-brand/15 transition"
                  >
                    <Printer className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                    PDF
                  </a>
                  <button
                    onClick={() => sendToTelegram(inv)}
                    disabled={sendingTelegram === inv.id}
                    className="h-11 px-3.5 flex items-center justify-center rounded-full border border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100 transition disabled:opacity-50"
                    title="Send to Telegram"
                  >
                    {sendingTelegram === inv.id ? (
                      <CircleNotch className="w-4 h-4 animate-spin" weight="bold" aria-hidden />
                    ) : (
                      <TelegramLogo className="w-4 h-4" weight="duotone" aria-hidden />
                    )}
                  </button>
                </div>
                {/* Row 2: Mark Paid (if not already paid) */}
                {inv.status !== 'paid' && (
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        await upsertInvoice({ ...inv, status: 'paid' });
                        setViewInvId(null);
                      });
                    }}
                    className="h-11 w-full flex items-center justify-center gap-2 rounded-full bg-brand-soft border border-brand/30 text-brand text-sm font-semibold hover:bg-brand-soft transition"
                  >
                    <Check className="w-4 h-4 shrink-0" weight="bold" aria-hidden />
                    Mark as Paid
                  </button>
                )}
                {/* Row 3: Delete */}
                <button
                  onClick={() => {
                    setViewInvId(null);
                    setDeleteId(inv.id);
                  }}
                  className="h-10 w-full flex items-center justify-center gap-2 rounded-full border border-red-200 text-red-600 text-sm hover:bg-red-100 hover:text-red-600 transition"
                >
                  <Trash className="w-4 h-4 shrink-0" weight="duotone" aria-hidden />
                  Delete Invoice
                </button>
              </div>
            </ModalShell>
          );
        })()}

      {/* ── Invoice form panel ──────────────────────────────────────────────────── */}
      {panelOpen && (
        <ModalShell onClose={closePanel} maxWidth="max-w-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
            <h2 className="text-lg font-bold text-ink">
              {editingId ? 'Edit invoice' : 'New invoice'}
            </h2>
            <button onClick={closePanel} className="text-muted hover:text-ink transition p-1">
              <X className="w-5 h-5" weight="bold" aria-hidden />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PanelField label="Invoice Number" required>
                <input
                  value={form.number}
                  onChange={(e) => setField('number', e.target.value)}
                  className={inputCls}
                  placeholder="INV-2025-001"
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
            </div>

            {/* Client */}
            <PanelField label="Client" required>
              <div ref={clientComboRef} className="relative">
                {(() => {
                  const selected = clients.find((c) => c.id === form.clientId);
                  const q = clientSearch.toLowerCase().trim();
                  const filtered = q
                    ? clients.filter((c) =>
                        [
                          c.name,
                          c.contactPerson ?? '',
                          c.phone,
                          c.email,
                          c.address,
                          c.note ?? '',
                        ].some((f) => f.toLowerCase().includes(q))
                      )
                    : clients;
                  return (
                    <>
                      <input
                        value={clientDropOpen ? clientSearch : (selected?.name ?? '')}
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
                          {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted">No clients found</div>
                          ) : (
                            filtered.map((c) => (
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

            <PanelField label="Payment Terms">
              <select
                value={form.paymentTerms}
                onChange={(e) => setField('paymentTerms', e.target.value)}
                className={inputCls}
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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
                {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => {
                  const active = form.status === s;
                  const sc = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setField('status', s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? `${sc.cls} border-current` : 'border-line-strong text-muted hover:bg-black/[0.04]'}`}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </PanelField>

            {/* Line items */}
            {(() => {
              const lineItemsReady =
                !!form.number.trim() &&
                !!form.date &&
                !!form.projectName?.trim() &&
                !!form.clientId;
              return (
                <div className="relative">
                  {!lineItemsReady && (
                    <div className="absolute inset-0 z-10 rounded-xl bg-surface-[2px] flex flex-col items-center justify-center gap-2 border border-line">
                      <LockSimple className="w-5 h-5 text-faint" weight="duotone" aria-hidden />
                      <p className="text-xs text-muted text-center px-4">
                        Fill in Invoice Number, Date, Project Name &amp; Client first
                      </p>
                    </div>
                  )}
                  <div
                    className={!lineItemsReady ? 'pointer-events-none select-none opacity-30' : ''}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-ink-2">Line Items</span>
                      <button
                        onClick={addItem}
                        className="flex items-center gap-1 text-xs text-muted hover:text-ink transition"
                      >
                        <Plus className="w-3.5 h-3.5" weight="bold" aria-hidden />
                        Add row
                      </button>
                    </div>
                    <div className="rounded-xl border border-line overflow-hidden divide-y divide-line">
                      {form.items.map((item) => {
                        const nlIdx = item.description.indexOf('\n');
                        const title =
                          nlIdx === -1 ? item.description : item.description.slice(0, nlIdx);
                        const scope = nlIdx === -1 ? '' : item.description.slice(nlIdx + 1);
                        const scopeLines = scope
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const setTitle = (t: string) =>
                          updateItem(item.id, { description: t + (scope ? '\n' + scope : '') });
                        const addScopeLine = (line: string) => {
                          const trimmed = line.trim();
                          if (!trimmed || scopeLines.includes(trimmed)) return;
                          const next = [...scopeLines, trimmed].join('\n');
                          updateItem(item.id, { description: title + '\n' + next });
                        };
                        const removeScopeLine = (line: string) => {
                          const next = scopeLines.filter((s) => s !== line).join('\n');
                          updateItem(item.id, { description: title + (next ? '\n' + next : '') });
                        };
                        const customVal = customScope[item.id] ?? '';
                        return (
                          <div key={item.id} className="bg-surface">
                            {/* Title row */}
                            <div className="flex items-center gap-2 pr-2">
                              <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={form.projectName || 'Project / event title…'}
                                className="flex-1 px-3 pt-2.5 pb-2 text-sm font-medium text-ink placeholder:text-faint focus:outline-none focus:bg-surface bg-transparent"
                              />
                              <button
                                onClick={() => removeItem(item.id)}
                                disabled={form.items.length === 1}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-faint hover:text-red-600 hover:bg-red-100 disabled:opacity-0 transition"
                              >
                                <X className="w-3.5 h-3.5" weight="bold" aria-hidden />
                              </button>
                            </div>
                            {/* Scope chips area */}
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
                                        className="ml-0.5 text-ink-2 hover:text-ink transition"
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
                                    setCustomScope((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
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
                                {customVal.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      addScopeLine(customVal);
                                      setCustomScope((prev) => ({ ...prev, [item.id]: '' }));
                                    }}
                                    className="text-xs text-muted hover:text-ink transition px-1"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Qty / Price / Total row */}
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
                              <div className="flex items-center gap-1.5 flex-1">
                                <span className="text-xs text-muted">$</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice === 0 ? '' : item.unitPrice}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      unitPrice: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="flex-1 h-8 rounded-lg border border-line-strong bg-subtle px-2 text-sm text-right text-ink focus:outline-none focus:ring-1 focus:ring-brand/40"
                                />
                              </div>
                              <span className="text-sm font-semibold text-ink-2 shrink-0">
                                {fmt(item.qty * item.unitPrice)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-col items-end gap-1.5 text-sm">
                      <div className="flex gap-8 pt-1.5 border-t border-line">
                        <span className="font-semibold text-ink-2">Grand Total</span>
                        <span className="font-bold text-ink w-28 text-right">{fmt(subtotal)}</span>
                      </div>
                      {form.withWHT && taxConfig.enabled && (
                        <>
                          <div className="flex gap-8 text-orange-600">
                            <span>
                              {taxConfig.type === 'deductive' ? 'Less' : 'Add'} {taxConfig.label}{' '}
                              {taxConfig.rate}%
                            </span>
                            <span className="font-medium w-28 text-right">({fmt(whtAmount)})</span>
                          </div>
                          <div className="flex gap-8 pt-1.5 border-t border-line mt-0.5">
                            <span className="font-semibold text-ink-2">Total (USD)</span>
                            <span className="font-bold text-ink w-28 text-right">
                              {fmt(netTotal)}
                            </span>
                          </div>
                        </>
                      )}
                      {form.depositPercent != null && (
                        <>
                          <div className="flex gap-8 text-brand">
                            <span>Deposit ({form.depositPercent}%)</span>
                            <span className="font-medium w-28 text-right">
                              − {fmt(depositAmount)}
                            </span>
                          </div>
                          <div className="flex gap-8 pt-1.5 border-t border-line mt-0.5">
                            <span className="font-semibold text-ink-2">Balance Due</span>
                            <span className="font-bold text-ink w-28 text-right">
                              {fmt(balanceDue)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tax toggle — only shown if tax is configured in workspace preferences */}
            {taxConfig.enabled && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-orange-50 border border-orange-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-700">
                    {taxConfig.label} ({taxConfig.rate}%)
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    {taxConfig.type === 'deductive'
                      ? `Gross-up unit prices so the client withholds ${taxConfig.rate}% and you receive the deal amount.`
                      : `Add ${taxConfig.rate}% ${taxConfig.label} on top of the invoice total.`}
                  </p>
                  {form.withWHT && (
                    <p className="text-xs text-orange-700 mt-2 font-medium">
                      Subtotal: {fmt(subtotal)} · {taxConfig.label}: ({fmt(whtAmount)}) · Net:{' '}
                      {fmt(netTotal)}
                    </p>
                  )}
                </div>
                <button
                  onClick={toggleWHT}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.withWHT ? 'bg-orange-500' : 'bg-zinc-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.withWHT ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}

            {/* Deposit toggle */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-brand-soft border border-brand/30">
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand">Deposit / Partial Payment</p>
                <p className="text-xs text-brand mt-0.5">
                  Require a deposit upfront; client pays the balance on delivery.
                </p>
                {form.depositPercent != null && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={form.depositPercent}
                      onChange={(e) =>
                        setField(
                          'depositPercent',
                          Math.min(99, Math.max(1, parseInt(e.target.value) || 50))
                        )
                      }
                      className="w-16 h-8 rounded-xl border border-brand/30 px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green-400 bg-subtle text-center"
                    />
                    <span className="text-sm text-brand">% deposit = {fmt(depositAmount)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() =>
                  setField('depositPercent', form.depositPercent != null ? undefined : 50)
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.depositPercent != null ? 'bg-green-500' : 'bg-zinc-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.depositPercent != null ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* VAT TIN toggle — only shown when the selected client has a VAT TIN */}
            {clients.find((c) => c.id === form.clientId)?.vat_tin && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-700">Show VAT TIN on Invoice</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Display the client&apos;s VAT TIN number in the Bill To section.
                  </p>
                </div>
                <button
                  onClick={() => setField('showVatTin', form.showVatTin ? undefined : true)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.showVatTin ? 'bg-blue-500' : 'bg-zinc-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.showVatTin ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}

            <PanelField label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className={`${inputCls} h-auto py-2 resize-none`}
                placeholder="Payment instructions, additional notes…"
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
                className="flex h-11 px-4 rounded-xl border border-line-strong bg-subtle text-sm text-ink hover:bg-black/[0.04] transition items-center gap-2"
              >
                <Eye className="w-4 h-4" weight="duotone" aria-hidden />
                Save & Preview
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="h-11 px-5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition disabled:opacity-60"
              >
                {editingId ? 'Save changes' : 'Create invoice'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────────── */}
      {deleteId && (
        <ConfirmDeleteModal
          title="Delete invoice?"
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </>
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
