'use client';

import { useState, useEffect, useRef, createElement, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sheet } from '@/src/features/invoices/components/InvoicePrint';
import {
  type Invoice,
  type LineItem,
  type InvoiceStatus,
  type Client,
  type Project,
  type CompanyProfile,
  type PaymentInfo,
  type ProjectItemStatus,
} from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { useCompanyProfile, usePaymentInfo, useScopeOfWork } from '@/src/hooks/useSettings';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { calcSubtotal, WHT_RATE } from '@/src/features/invoices/lib/calculations';
import { fmtUSD, fmtDate } from '@/src/lib/formatters';
import { uid } from '@/src/lib/id';
import { PAYMENT_TERMS, PAGE_SIZE, STORAGE_KEYS } from '@/src/config/constants';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import SortTh from '@/src/components/SortTh';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import ModalShell from '@/src/components/ModalShell';
import ProjectDetailModal from '@/src/features/projects/components/ProjectDetailModal';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';
import { useInvoiceMutations } from '@/src/hooks/useInvoices';
import { useProjectMutations } from '@/src/hooks/useProjects';

const fmt = fmtUSD;

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
  'h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full';

export default function InvoicesView() {
  const { data: clients, isLoading } = useClients();
  const { data: invoices } = useInvoices();
  const { data: projects } = useProjects();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: companyProfile } = useCompanyProfile();
  const { data: paymentInfo } = usePaymentInfo();

  const [isPending, startTransition] = useTransition();
  const { upsert: upsertInvoice, remove: deleteInvoice } = useInvoiceMutations();
  const { upsert: upsertProject } = useProjectMutations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const didAutoOpen = useRef(false);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const awaitingBalance = invoices.filter((inv) => inv.status === 'partial');
  const paidRevenue = paidInvoices.reduce((s, inv) => s + calcSubtotal(inv), 0);
  const depositRevenue = awaitingBalance.reduce(
    (s, inv) => s + calcSubtotal(inv) * ((inv.depositPercent ?? 0) / 100),
    0
  );

  // ── Telegram ───────────────────────────────────────────────────────────────
  const [sendingTelegram, setSendingTelegram] = useState<string | null>(null);

  async function generatePdfBlob(inv: Invoice): Promise<Blob> {
    const [html2canvas, { default: jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ]);

    const client = clients.find((c) => c.id === inv.clientId) ?? null;
    const subtotal = inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const whtAmount = inv.withWHT ? subtotal * WHT_RATE : null;
    const netTotal = inv.withWHT ? subtotal * (1 - WHT_RATE) : subtotal;
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
          payment: paymentInfo ?? ({} as PaymentInfo),
          subtotal,
          whtAmount,
          netTotal,
          depositAmount,
          balanceDue,
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
      alert('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSendingTelegram(inv.id);
    try {
      const client = clients.find((c) => c.id === inv.clientId);
      const pdfBlob = await generatePdfBlob(inv);

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', pdfBlob, `${inv.number}.pdf`);
      const invoiceUrl = `${window.location.origin}/invoices/${inv.id}`;
      formData.append(
        'caption',
        [
          `📄 *${inv.number}*`,
          `📅 Date: ${inv.date}`,
          `👤 Client: ${client?.name ?? '—'}`,
          `🔗 ${invoiceUrl}`,
        ].join('\n')
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
        alert(`Telegram error: ${err.description ?? res.statusText}`);
      }
    } catch (e) {
      alert(`Failed to send: ${e instanceof Error ? e.message : 'unknown error'}`);
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
  });

  const [form, setForm] = useState<FormState>(blankForm);

  // Project combobox + multi-select
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectDropOpen, setProjectDropOpen] = useState(false);
  const projectComboRef = useRef<HTMLDivElement>(null);

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
    setProjectSearch('');
    setProjectDropOpen(false);
    setSelectedProjectIds([]);
    setPanelOpen(true);
  }

  useEffect(() => {
    if (didAutoOpen.current) return;
    if (searchParams.get('new') === '1') {
      didAutoOpen.current = true;

      openNew();
      router.replace('/dashboard/invoices');
    }
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
    });
    setSelectedProjectIds(projects.filter((p) => p.invoiceIds.includes(inv.id)).map((p) => p.id));
    setFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setProjectSearch('');
    setProjectDropOpen(false);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
    setFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setProjectSearch('');
    setProjectDropOpen(false);
    setSelectedProjectIds([]);
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

  // Conflict popup: project already linked to another invoice
  const [conflictProject, setConflictProject] = useState<Project | null>(null);

  function addProjectToForm(project: Project) {
    setSelectedProjectIds((prev) => [...prev, project.id]);
    const scopeLines = project.items.map((i) => i.description).filter(Boolean);
    const description = project.name + (scopeLines.length > 0 ? '\n' + scopeLines.join('\n') : '');
    const newItem = { id: uid(), description, qty: 1, unitPrice: project.budget ?? 0 };
    setForm((prev) => {
      const existingItems = prev.items.filter((it) => it.description.trim() || it.unitPrice > 0);
      return {
        ...prev,
        projectName: prev.projectName?.trim() || project.name,
        clientId: project.clientId,
        items: [...existingItems, newItem],
      };
    });
  }

  function selectProject(project: Project) {
    if (selectedProjectIds.includes(project.id)) {
      setProjectSearch('');
      setProjectDropOpen(false);
      return;
    }
    setProjectSearch('');
    setProjectDropOpen(false);
    // Check if already linked to another invoice (excluding the one being edited)
    const alreadyLinked = project.invoiceIds.filter((id) => id !== editingId);
    if (alreadyLinked.length > 0) {
      setConflictProject(project);
      return;
    }
    addProjectToForm(project);
  }

  function removeSelectedProject(projectId: string) {
    setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId));
  }

  function handleSave() {
    if (!form.projectName?.trim()) {
      setFormError('Project / Campaign Name is required.');
      return;
    }
    if (!form.clientId) {
      setFormError('Please select a client.');
      return;
    }
    if (!form.number.trim()) {
      setFormError('Invoice number is required.');
      return;
    }
    const duplicate = invoices.find(
      (inv) => inv.number === form.number.trim() && inv.id !== editingId
    );
    if (duplicate) {
      setFormError(`Invoice number "${form.number.trim()}" is already used.`);
      return;
    }
    if (form.items.some((it) => !it.description.trim())) {
      setFormError('All line items need a description.');
      return;
    }

    const invoiceId = editingId ?? uid();
    startTransition(async () => {
      await upsertInvoice({ id: invoiceId, ...form });
      // sync project links
      for (const p of projects) {
        const wasLinked = p.invoiceIds.includes(invoiceId);
        const isSelected = selectedProjectIds.includes(p.id);
        if (isSelected && !wasLinked) {
          await upsertProject({ ...p, invoiceIds: [...p.invoiceIds, invoiceId] });
        } else if (!isSelected && wasLinked) {
          await upsertProject({ ...p, invoiceIds: p.invoiceIds.filter((id) => id !== invoiceId) });
        }
      }
      closePanel();
    });
  }

  function handleSaveAndPreview() {
    if (
      !form.projectName?.trim() ||
      !form.clientId ||
      !form.number.trim() ||
      form.items.some((it) => !it.description.trim())
    ) {
      handleSave(); // will set the error message
      return;
    }
    const invoiceId = editingId ?? uid();
    window.open(`/invoices/${invoiceId}`, '_blank');
    handleSave();
  }

  const subtotal = form.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const whtAmount = form.withWHT ? subtotal * WHT_RATE : 0;
  const netTotal = form.withWHT ? subtotal * (1 - WHT_RATE) : subtotal;
  const depositAmount = form.depositPercent != null ? netTotal * (form.depositPercent / 100) : 0;
  const balanceDue = netTotal - depositAmount;

  function toggleWHT() {
    setForm((prev) => {
      const enabling = !prev.withWHT;
      return {
        ...prev,
        withWHT: enabling || undefined,
        items: prev.items.map((it) => ({
          ...it,
          unitPrice: enabling
            ? Math.round((it.unitPrice / (1 - WHT_RATE)) * 100) / 100
            : Math.round(it.unitPrice * (1 - WHT_RATE) * 100) / 100,
        })),
      };
    });
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [linkProjectInvId, setLinkProjectInvId] = useState<string | null>(null);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);

  // Link/create project state
  const [cpMode, setCpMode] = useState<'create' | 'link'>('create');
  const [cpName, setCpName] = useState('');
  const [cpItems, setCpItems] = useState<
    { id: string; description: string; status: ProjectItemStatus }[]
  >([]);
  const [cpExcluded, setCpExcluded] = useState<Set<string>>(new Set());
  const [cpLinkId, setCpLinkId] = useState('');

  function openLinkProject(inv: Invoice) {
    const client = clients.find((c) => c.id === inv.clientId);
    const clientProjects = projects.filter(
      (p) => p.clientId === inv.clientId && !p.invoiceIds.includes(inv.id)
    );
    setCpMode(clientProjects.length > 0 ? 'link' : 'create');
    setCpName(inv.projectName || client?.name || '');
    setCpItems(
      inv.items
        .filter((it) => it.description.trim())
        .flatMap((it) => {
          const lines = it.description
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
          // Skip first line (project title), use individual scope lines
          const scopeLines = lines.length > 1 ? lines.slice(1) : lines;
          return scopeLines.map((line) => ({
            id: uid(),
            description: line,
            status: 'todo' as ProjectItemStatus,
          }));
        })
    );
    setCpExcluded(new Set());
    setCpLinkId(clientProjects[0]?.id ?? '');
    setLinkProjectInvId(inv.id);
  }

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
  const [sortCol, setSortCol] = useState<InvSortCol>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEYS.tableInvCol) as InvSortCol) ?? 'number')
      : 'number'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() =>
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

  function handleSort(col: string) {
    const nextDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(col as InvSortCol);
    setSortDir(nextDir);
    setPage(1);
    localStorage.setItem(STORAGE_KEYS.tableInvCol, col);
    localStorage.setItem(STORAGE_KEYS.tableInvDir, nextDir);
    localStorage.setItem(STORAGE_KEYS.tableInvPage, '1');
  }
  function goToPage(p: number) {
    setPage(p);
    localStorage.setItem(STORAGE_KEYS.tableInvPage, String(p));
  }

  const filteredInvoices = invoices.filter((inv) => {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-sm text-white/45 mt-0.5">{invoices.length} total</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-yellow-400 transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New invoice
        </button>
      </div>

      {/* Summary widgets */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label="Paid"
            value={String(paidInvoices.length)}
            sub={`${fmt(paidRevenue)} received`}
            isAmountSub
          />
          <SummaryCard
            label="Deposit Rcvd"
            value={String(awaitingBalance.length)}
            sub={`${fmt(depositRevenue)} collected`}
            accent="amber"
            isAmountSub
          />
          <SummaryCard
            label="Active"
            value={String(
              invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length
            )}
            sub={`${invoices.filter((i) => i.status === 'overdue').length} late`}
            accent={invoices.some((i) => i.status === 'overdue') ? 'red' : undefined}
          />
          <SummaryCard
            label="Draft"
            value={String(invoices.filter((i) => i.status === 'draft').length)}
            sub="not yet sent"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/[0.08]">
        {(
          [
            { key: 'all', label: 'All', count: invoices.length },
            {
              key: 'active',
              label: 'Active',
              count: invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length,
            },
            {
              key: 'partial',
              label: 'Deposit Rcvd',
              count: invoices.filter((i) => i.status === 'partial').length,
            },
            {
              key: 'paid',
              label: 'Paid',
              count: invoices.filter((i) => i.status === 'paid').length,
            },
            {
              key: 'overdue',
              label: 'Late',
              count: invoices.filter((i) => i.status === 'overdue').length,
            },
            {
              key: 'draft',
              label: 'Draft',
              count: invoices.filter((i) => i.status === 'draft').length,
            },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px whitespace-nowrap ${statusFilter === key ? 'border-[#FFC206] text-[#FFC206]' : 'border-transparent text-white/45 hover:text-white/70'}`}
          >
            {label}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${statusFilter === key ? 'bg-[#FFC206]/20 text-[#FFC206]' : 'bg-white/10 text-white/40'}`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice #, client, amount…"
        />
      </div>

      {/* Empty states */}
      {invoices.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl flex flex-col items-center justify-center py-20 text-white/35">
          <svg
            className="w-10 h-10 mb-3 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">No invoices yet. Create your first one.</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl flex flex-col items-center justify-center py-14 text-white/35">
          <p className="text-sm">No invoices match your search.</p>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="mt-2 text-xs text-[#FFC206] hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04] text-xs font-medium text-white/45">
                  <SortTh
                    col="number"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3"
                  >
                    Invoice #
                  </SortTh>
                  <th className="text-left px-4 py-3">Client</th>
                  <SortTh
                    col="date"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3 hidden sm:table-cell"
                  >
                    Date
                  </SortTh>
                  <SortTh
                    col="amount"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right px-4 py-3"
                  >
                    Amount
                  </SortTh>
                  <th className="text-left px-4 py-3 hidden md:table-cell w-40">Project</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pagedInvoices.map((inv, i) => {
                  const client = clients.find((c) => c.id === inv.clientId);
                  const sub = calcSubtotal(inv);
                  const wht = inv.withWHT ? sub * WHT_RATE : null;
                  const net = wht != null ? sub - wht : sub;
                  const invDeposit =
                    inv.depositPercent != null ? net * (inv.depositPercent / 100) : null;
                  const invBalance = invDeposit != null ? net - invDeposit : null;
                  const status = (inv.status ?? 'draft') as InvoiceStatus;
                  const sc = STATUS_CONFIG[status];
                  const linkedProjects = projects.filter((p) => p.invoiceIds.includes(inv.id));
                  const allItems = linkedProjects.flatMap((p) => p.items);

                  return (
                    <tr
                      key={inv.id}
                      className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-4 py-3.5 font-semibold text-white whitespace-nowrap">
                        {inv.number}
                      </td>
                      <td className="px-4 py-3.5 text-white/60 max-w-[120px] truncate">
                        {client?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-white/50 whitespace-nowrap hidden sm:table-cell">
                        {fmtDate(inv.date)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="font-semibold text-white amt">{fmt(sub)}</span>
                        {wht != null && (
                          <div className="flex flex-col items-end gap-0.5 mt-0.5">
                            <span className="text-xs text-orange-400/80">
                              −<span className="amt">{fmt(wht)}</span> WHT
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
                      {/* Project column */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          {linkedProjects.map((lp) => {
                            const lpDone = lp.items.filter((it) => it.status === 'done').length;
                            const lpTotal = lp.items.length;
                            const lpPct = lpTotal > 0 ? Math.round((lpDone / lpTotal) * 100) : 0;
                            return (
                              <button
                                key={lp.id}
                                onClick={() => setViewProjectId(lp.id)}
                                className="text-left group"
                                title={`${lp.name} — ${lpPct}%`}
                              >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs text-white/60 group-hover:text-white transition truncate max-w-[96px]">
                                    {lp.name}
                                  </span>
                                  {lpTotal > 0 && (
                                    <span className="text-xs text-white/35 shrink-0">{lpPct}%</span>
                                  )}
                                </div>
                                {lpTotal > 0 && (
                                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${lpPct === 100 ? 'bg-green-400' : 'bg-[#FFC206]'}`}
                                      style={{ width: `${Math.max(lpPct, lpPct > 0 ? 4 : 0)}%` }}
                                    />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => openLinkProject(inv)}
                            className="flex items-center gap-1 text-xs text-white/35 hover:text-[#FFC206] transition group mt-0.5"
                          >
                            <svg
                              className="w-3 h-3 group-hover:scale-110 transition-transform"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                            {linkedProjects.length > 0 ? 'Add project' : 'Link project'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {status === 'draft' && (
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  await upsertInvoice({ ...inv, status: 'sent' });
                                });
                                window.open(`/invoices/${inv.id}`, '_blank');
                              }}
                              className="h-10 px-4 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold hover:bg-blue-500/25 transition whitespace-nowrap"
                            >
                              Mark Sent
                            </button>
                          )}
                          {/* Mobile project button */}
                          <button
                            onClick={() => openLinkProject(inv)}
                            className={`p-2.5 rounded-xl border transition ${linkedProjects.length > 0 ? 'border-blue-400/30 text-blue-300 bg-blue-500/15 hover:bg-blue-500/25' : 'border-white/15 text-white/40 hover:bg-white/10'}`}
                            title={
                              linkedProjects.length > 0
                                ? linkedProjects.map((p) => p.name).join(', ')
                                : 'Link project'
                            }
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
                                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => sendToTelegram(inv)}
                            disabled={sendingTelegram === inv.id}
                            className="p-2.5 rounded-xl border border-white/15 text-sky-400 hover:bg-white/10 transition disabled:opacity-50"
                            title="Send to Telegram"
                          >
                            {sendingTelegram === inv.id ? (
                              <svg
                                className="w-3.5 h-3.5 animate-spin"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"
                                />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                              </svg>
                            )}
                          </button>
                          <a
                            href={`/invoices/${inv.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl border border-white/15 text-white/50 hover:bg-white/10 transition"
                            title="PDF"
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
                          </a>
                          <button
                            onClick={() => openEdit(inv)}
                            className="p-2.5 rounded-xl border border-white/15 text-white/50 hover:bg-white/10 transition"
                            title="Edit"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            className="p-2.5 rounded-xl border border-red-400/30 text-red-400 hover:bg-red-500/15 transition"
                            title="Delete"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={sortedInvoices.length}
        pageSize={PAGE_SIZE}
        onPageChange={goToPage}
      />

      {/* ── Invoice form panel ──────────────────────────────────────────────────── */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 w-full md:max-w-2xl bg-slate-900/95 backdrop-blur-2xl border-l border-white/[0.1] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit invoice' : 'New invoice'}
              </h2>
              <button
                onClick={closePanel}
                className="text-white/40 hover:text-white transition p-1"
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

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
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
                            if (!e.target.value) {
                              setField('clientId', '');
                              setSelectedProjectIds([]);
                            }
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
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/[0.1] bg-slate-800/95 backdrop-blur-xl shadow-lg">
                            {filtered.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-white/40">
                                No clients found
                              </div>
                            ) : (
                              filtered.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseDown={() => {
                                    if (c.id !== form.clientId) setSelectedProjectIds([]);
                                    setField('clientId', c.id);
                                    setClientSearch('');
                                    setClientDropOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 hover:bg-white/10 transition ${form.clientId === c.id ? 'bg-[#FFC206]/10' : ''}`}
                                >
                                  <div className="text-sm font-medium text-white">{c.name}</div>
                                  {(c.contactPerson || c.email || c.phone) && (
                                    <div className="text-xs text-white/40 truncate">
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

              <PanelField label="Linked Projects">
                <div ref={projectComboRef} className="relative flex flex-col gap-2">
                  {selectedProjectIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProjectIds.map((pid) => {
                        const lp = projects.find((p) => p.id === pid);
                        if (!lp) return null;
                        return (
                          <span
                            key={pid}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-400/25 text-xs text-blue-300"
                          >
                            {lp.name}
                            <button
                              type="button"
                              onClick={() => removeSelectedProject(pid)}
                              className="ml-0.5 text-blue-300/60 hover:text-blue-200 transition"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <input
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setProjectDropOpen(true);
                    }}
                    onFocus={() => {
                      if (form.clientId) setProjectDropOpen(true);
                    }}
                    onBlur={() => setTimeout(() => setProjectDropOpen(false), 150)}
                    placeholder={
                      form.clientId ? 'Search and add projects…' : 'Select a client first'
                    }
                    disabled={!form.clientId}
                    className={`${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`}
                  />
                  {projectDropOpen &&
                    form.clientId &&
                    (() => {
                      const q = projectSearch.toLowerCase().trim();
                      const available = projects.filter(
                        (p) =>
                          p.clientId === form.clientId &&
                          p.status !== 'unconfirmed' &&
                          !selectedProjectIds.includes(p.id)
                      );
                      const filtered = q
                        ? available.filter((p) => p.name.toLowerCase().includes(q))
                        : available;
                      if (filtered.length === 0) return null;
                      return (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/[0.1] bg-slate-800/95 backdrop-blur-xl shadow-lg">
                          {filtered.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={() => selectProject(p)}
                              className="w-full text-left px-3 py-2 hover:bg-white/10 transition"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-white truncate">
                                  {p.name}
                                </div>
                                {p.budget ? (
                                  <div className="text-xs text-[#FFC206] shrink-0">
                                    ${p.budget.toLocaleString()}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
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

              <PanelField label="Status">
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => {
                    const active = form.status === s;
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setField('status', s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? `${sc.cls} border-current` : 'border-white/15 text-white/40 hover:bg-white/10'}`}
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
                      <div className="absolute inset-0 z-10 rounded-xl bg-slate-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-white/[0.08]">
                        <svg
                          className="w-5 h-5 text-white/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <p className="text-xs text-white/40 text-center px-4">
                          Fill in Invoice Number, Date, Project Name &amp; Client first
                        </p>
                      </div>
                    )}
                    <div
                      className={
                        !lineItemsReady ? 'pointer-events-none select-none opacity-30' : ''
                      }
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-white/70">Line Items</span>
                        <button
                          onClick={addItem}
                          className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add row
                        </button>
                      </div>
                      <div className="rounded-xl border border-white/[0.1] overflow-hidden">
                        <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-px bg-white/[0.08] text-xs font-medium text-white/45">
                          <div className="bg-slate-800/80 px-3 py-2">Description</div>
                          <div className="bg-slate-800/80 px-3 py-2 text-center">Qty</div>
                          <div className="bg-slate-800/80 px-3 py-2 text-right">Unit Price</div>
                          <div className="bg-slate-800/80 px-3 py-2 text-right">Total</div>
                          <div className="bg-slate-800/80" />
                        </div>
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
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-px bg-white/[0.08] items-start"
                            >
                              <div className="bg-slate-900/60 flex flex-col gap-0">
                                {/* Title */}
                                <input
                                  value={title}
                                  onChange={(e) => setTitle(e.target.value)}
                                  placeholder={form.projectName || 'Project / event title…'}
                                  className="px-3 pt-2.5 pb-2 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:bg-white/[0.04] w-full bg-transparent"
                                />
                                {/* Scope chips area */}
                                <div className="px-3 pb-2.5 border-t border-white/[0.06]">
                                  {/* Added scope chips */}
                                  {scopeLines.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-2 pb-1.5">
                                      {scopeLines.map((line) => (
                                        <span
                                          key={line}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFC206] text-zinc-900 text-xs font-bold"
                                        >
                                          {line}
                                          <button
                                            type="button"
                                            onClick={() => removeScopeLine(line)}
                                            className="ml-0.5 text-zinc-700 hover:text-zinc-900 transition"
                                          >
                                            <svg
                                              className="w-2.5 h-2.5"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                              strokeWidth={2.5}
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M6 18L18 6M6 6l12 12"
                                              />
                                            </svg>
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {/* Suggestion chips */}
                                  {scopeOfWork.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                                      {scopeOfWork
                                        .filter((s) => !scopeLines.includes(s))
                                        .map((sug) => (
                                          <button
                                            key={sug}
                                            type="button"
                                            onClick={() => addScopeLine(sug)}
                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-white/[0.08] text-white/50 text-xs hover:bg-white/[0.15] hover:text-white transition"
                                          >
                                            <svg
                                              className="w-2.5 h-2.5"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                              strokeWidth={2.5}
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 4v16m8-8H4"
                                              />
                                            </svg>
                                            {sug}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                  {/* Custom scope input */}
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
                                      className="flex-1 h-6 text-xs text-white/60 placeholder:text-white/20 focus:outline-none bg-transparent"
                                    />
                                    {customVal.trim() && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          addScopeLine(customVal);
                                          setCustomScope((prev) => ({ ...prev, [item.id]: '' }));
                                        }}
                                        className="text-xs text-white/40 hover:text-white transition px-1"
                                      >
                                        Add
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={item.qty === 0 ? '' : item.qty}
                                onChange={(e) =>
                                  updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })
                                }
                                className="bg-slate-900/60 px-3 py-2 text-sm text-center text-white focus:outline-none focus:bg-white/[0.06]"
                              />
                              <input
                                type="number"
                                min={0}
                                value={item.unitPrice === 0 ? '' : item.unitPrice}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    unitPrice: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="bg-slate-900/60 px-3 py-2 text-sm text-right text-white focus:outline-none focus:bg-white/[0.06]"
                              />
                              <div className="bg-slate-900/60 px-3 py-2 text-sm text-right text-white/70 font-medium">
                                {fmt(item.qty * item.unitPrice)}
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                disabled={form.items.length === 1}
                                className="bg-slate-900/60 flex items-center justify-center text-white/20 hover:text-red-400 disabled:opacity-0 transition pt-2.5"
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
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-col items-end gap-1.5 text-sm">
                        <div className="flex gap-8 pt-1.5 border-t border-white/[0.1]">
                          <span className="font-semibold text-white/70">Grand Total</span>
                          <span className="font-bold text-white w-28 text-right">
                            {fmt(subtotal)}
                          </span>
                        </div>
                        {form.withWHT && (
                          <>
                            <div className="flex gap-8 text-orange-400">
                              <span>Less WHT {WHT_RATE * 100}%</span>
                              <span className="font-medium w-28 text-right">
                                ({fmt(whtAmount)})
                              </span>
                            </div>
                            <div className="flex gap-8 pt-1.5 border-t border-white/[0.1] mt-0.5">
                              <span className="font-semibold text-white/70">Total (USD)</span>
                              <span className="font-bold text-white w-28 text-right">
                                {fmt(netTotal)}
                              </span>
                            </div>
                          </>
                        )}
                        {form.depositPercent != null && (
                          <>
                            <div className="flex gap-8 text-green-400">
                              <span>Deposit ({form.depositPercent}%)</span>
                              <span className="font-medium w-28 text-right">
                                − {fmt(depositAmount)}
                              </span>
                            </div>
                            <div className="flex gap-8 pt-1.5 border-t border-white/[0.1] mt-0.5">
                              <span className="font-semibold text-white/70">Balance Due</span>
                              <span className="font-bold text-white w-28 text-right">
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

              {/* WHT toggle */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-300">Withholding Tax (WHT 15%)</p>
                  <p className="text-xs text-orange-400/70 mt-0.5">
                    Gross-up unit prices so the client withholds 15% and you receive the deal
                    amount.
                  </p>
                  {form.withWHT && (
                    <p className="text-xs text-orange-300 mt-2 font-medium">
                      Grand Total: {fmt(subtotal)} · Less WHT: ({fmt(whtAmount)}) · You receive:{' '}
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

              {/* Deposit toggle */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-300">Deposit / Partial Payment</p>
                  <p className="text-xs text-green-400/70 mt-0.5">
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
                        className="w-16 h-8 rounded-xl border border-green-400/30 px-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-400 bg-white/10 text-center"
                      />
                      <span className="text-sm text-green-300">
                        % deposit = {fmt(depositAmount)}
                      </span>
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
                <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-300">Show VAT TIN on Invoice</p>
                    <p className="text-xs text-blue-400/70 mt-0.5">
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

            <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between shrink-0">
              {formError ? <p className="text-sm text-red-400">{formError}</p> : <span />}
              <div className="flex gap-3">
                <button
                  onClick={closePanel}
                  className="h-11 px-5 rounded-xl border border-white/20 bg-white/10 text-sm text-white hover:bg-white/15 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAndPreview}
                  className="h-11 px-5 rounded-xl border border-white/20 bg-white/10 text-sm text-white hover:bg-white/15 transition flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Save & Preview
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="h-11 px-5 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-60"
                >
                  {editingId ? 'Save changes' : 'Create invoice'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────────── */}
      {deleteId && (
        <ConfirmDeleteModal
          title="Delete invoice?"
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}

      {/* ── Project already linked conflict ────────────────────────────────────── */}
      {conflictProject &&
        (() => {
          const conflictInvoices = conflictProject.invoiceIds
            .filter((id) => id !== editingId)
            .map((id) => invoices.find((inv) => inv.id === id))
            .filter(Boolean) as Invoice[];
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm bg-slate-900 border border-white/[0.1] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-white">Project already invoiced</p>
                  <p className="text-sm text-white/60">
                    <span className="text-white font-medium">{conflictProject.name}</span> is
                    already linked to {conflictInvoices.length === 1 ? 'invoice' : 'invoices'}{' '}
                    <span className="text-[#FFC206] font-medium">
                      {conflictInvoices.map((inv) => inv.number).join(', ')}
                    </span>
                    . Do you still want to add it?
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {conflictInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => window.open(`/invoices/${inv.id}`, '_blank')}
                      className="w-full h-10 px-4 rounded-xl border border-blue-400/30 bg-blue-500/15 text-sm text-blue-300 hover:bg-blue-500/25 transition"
                    >
                      View {inv.number}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      addProjectToForm(conflictProject);
                      setConflictProject(null);
                    }}
                    className="w-full h-10 px-4 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-yellow-400 transition"
                  >
                    Still Add
                  </button>
                  <button
                    onClick={() => setConflictProject(null)}
                    className="w-full h-10 px-4 rounded-xl border border-white/20 text-sm text-white/60 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── Link / Create project ───────────────────────────────────────────────── */}
      {linkProjectInvId &&
        (() => {
          const inv = invoices.find((i) => i.id === linkProjectInvId);
          const client = inv ? clients.find((c) => c.id === inv.clientId) : null;
          const clientProjects = inv
            ? projects.filter((p) => p.clientId === inv.clientId && !p.invoiceIds.includes(inv.id))
            : [];
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setLinkProjectInvId(null)}
              />
              <div className="relative z-10 w-full max-w-lg bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white">Link project</h2>
                    {inv && (
                      <p className="text-xs text-white/40 mt-0.5">
                        {inv.number} · {client?.name ?? '—'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setLinkProjectInvId(null)}
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

                {/* Tabs */}
                {clientProjects.length > 0 && (
                  <div className="flex border-b border-white/[0.08] shrink-0">
                    {(['link', 'create'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setCpMode(m)}
                        className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${cpMode === m ? 'border-[#FFC206] text-[#FFC206]' : 'border-transparent text-white/50 hover:text-white'}`}
                      >
                        {m === 'link' ? 'Link existing' : 'Create new'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                  {cpMode === 'link' && clientProjects.length > 0 ? (
                    <>
                      <p className="text-sm text-white/50">
                        Pick an existing project to attach this invoice to.
                      </p>
                      <div className="flex flex-col gap-2">
                        {clientProjects.map((p) => {
                          const done = p.items.filter((it) => it.status === 'done').length;
                          const total = p.items.length;
                          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${cpLinkId === p.id ? 'border-[#FFC206] bg-[#FFC206]/10' : 'border-white/10 hover:border-white/25 bg-white/[0.04]'}`}
                            >
                              <input
                                type="radio"
                                name="linkProject"
                                value={p.id}
                                checked={cpLinkId === p.id}
                                onChange={() => setCpLinkId(p.id)}
                                className="accent-[#FFC206]"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">{p.name}</p>
                                {total > 0 && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${pct === 100 ? 'bg-green-400' : 'bg-[#FFC206]'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-white/35 shrink-0">{pct}%</span>
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-white/70">Project name</label>
                        <input
                          type="text"
                          value={cpName}
                          onChange={(e) => setCpName(e.target.value)}
                          placeholder={client?.name ?? 'Project name…'}
                          className={inputCls}
                        />
                        {client && !cpName && (
                          <button
                            onClick={() => setCpName(client.name)}
                            className="self-start text-xs text-[#FFC206] hover:underline"
                          >
                            Use &quot;{client.name}&quot;
                          </button>
                        )}
                      </div>
                      {cpItems.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-white/70">
                            Scope items from invoice
                          </label>
                          <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-3 max-h-48 overflow-y-auto">
                            {cpItems.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-center gap-2.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={!cpExcluded.has(item.id)}
                                  onChange={() =>
                                    setCpExcluded((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    })
                                  }
                                  className="rounded accent-[#FFC206]"
                                />
                                <span
                                  className={`text-sm ${cpExcluded.has(item.id) ? 'line-through text-white/25' : 'text-white/80'}`}
                                >
                                  {item.description}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-white/35">
                            Uncheck items to exclude from project.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-white/[0.08] justify-end shrink-0">
                  <button
                    onClick={() => setLinkProjectInvId(null)}
                    className="h-11 px-5 rounded-xl border border-white/20 bg-white/10 text-sm text-white hover:bg-white/15 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!inv) return;
                      startTransition(async () => {
                        if (cpMode === 'link' && cpLinkId) {
                          const p = projects.find((p) => p.id === cpLinkId);
                          if (p)
                            await upsertProject({ ...p, invoiceIds: [...p.invoiceIds, inv.id] });
                        } else {
                          const name = cpName.trim() || (client?.name ?? 'New Project');
                          await upsertProject({
                            id: uid(),
                            name,
                            clientId: inv.clientId,
                            invoiceIds: [inv.id],
                            items: cpItems.filter((it) => !cpExcluded.has(it.id)),
                            status: 'confirmed',
                            createdAt: new Date().toISOString(),
                            phases: undefined,
                            filmingDate: undefined,
                            deliverDate: undefined,
                            confirmedMonth: undefined,
                            budget: undefined,
                            note: undefined,
                          });
                        }
                        setLinkProjectInvId(null);
                        setCpName('');
                        setCpItems([]);
                        setCpExcluded(new Set());
                        setCpLinkId('');
                      });
                    }}
                    disabled={isPending}
                    className="h-11 px-5 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-60"
                  >
                    {cpMode === 'link' ? 'Link project' : 'Create project'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── View project detail ─────────────────────────────────────────────────── */}
      {viewProjectId && (
        <ProjectDetailModal projectId={viewProjectId} onClose={() => setViewProjectId(null)} />
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
      <label className="text-sm font-medium text-white/70">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
  isAmountSub,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: 'amber' | 'red';
  isAmountSub?: boolean;
}) {
  const subCls =
    accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-white/40';
  const valCls =
    accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-white';
  return (
    <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-2xl px-4 py-4">
      <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${valCls}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${subCls}`}>
        {isAmountSub ? <span className="amt">{sub}</span> : sub}
      </p>
    </div>
  );
}
