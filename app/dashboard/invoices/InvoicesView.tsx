'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  useStore,
  type Invoice,
  type LineItem,
  type InvoiceStatus,
  type Client,
  type ProjectItemStatus,
} from '../AppStore';
import { calcSubtotal, WHT_RATE } from '@/app/_services/invoiceService';
import { fmtUSD } from '@/app/_lib/formatters';
import { uid } from '@/app/_lib/id';
import { PAYMENT_TERMS, PAGE_SIZE, STORAGE_KEYS } from '@/app/_config/constants';
import { STATUS_CONFIG } from '@/app/_config/statusConfig';
import SortTh from '@/app/_components/SortTh';
import SearchInput from '@/app/_components/SearchInput';
import Pagination from '@/app/_components/Pagination';
import ModalShell from '@/app/_components/ModalShell';
import ProjectDetailModal from '@/app/_components/ProjectDetailModal';

const fmt = fmtUSD;

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
  'h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition w-full bg-white';
const EMPTY_CLIENT_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };

export default function InvoicesView() {
  const { clients, setClients, invoices, setInvoices, projects, setProjects, scopeOfWork } =
    useStore();
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

  // ── Invoice form panel ─────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [customScope, setCustomScope] = useState<Record<string, string>>({});

  const blankForm = (): FormState => ({
    number: nextInvoiceNumber(invoices),
    date: new Date().toISOString().slice(0, 10),
    paymentTerms: 'Due on receipt',
    status: 'draft',
    clientId: '',
    projectName: '',
    items: [emptyItem()],
    notes: '',
    depositPercent: undefined,
    withWHT: undefined,
  });

  const [form, setForm] = useState<FormState>(blankForm);

  // Client combobox
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  // Inline client creation
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientFormError, setClientFormError] = useState('');

  function openNew() {
    setEditingId(null);
    setForm(blankForm());
    setFormError('');
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setPanelOpen(true);
  }

  useEffect(() => {
    if (didAutoOpen.current) return;
    if (searchParams.get('new') === '1') {
      didAutoOpen.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    });
    setFormError('');
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
    setClientSearch('');
    setClientDropOpen(false);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
    setFormError('');
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
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

  function saveNewClient() {
    if (!clientForm.name.trim()) {
      setClientFormError('Name is required.');
      return;
    }
    const newClient: Client = { id: uid(), ...clientForm };
    setClients([...clients, newClient]);
    setField('clientId', newClient.id);
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
  }

  function handleSave() {
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
    if (editingId) {
      setInvoices(invoices.map((inv) => (inv.id === editingId ? { id: editingId, ...form } : inv)));
    } else {
      setInvoices([...invoices, { id: uid(), ...form }]);
    }
    closePanel();
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
        .map((it) => ({
          id: uid(),
          description: it.description,
          status: 'todo' as ProjectItemStatus,
        }))
    );
    setCpExcluded(new Set());
    setCpLinkId(clientProjects[0]?.id ?? '');
    setLinkProjectInvId(inv.id);
  }

  function handleDelete(id: string) {
    setInvoices(invoices.filter((inv) => inv.id !== id));
    setDeleteId(null);
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
          <h1 className="text-xl font-semibold text-zinc-900">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{invoices.length} total</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
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
          />
          <SummaryCard
            label="Deposit Rcvd"
            value={String(awaitingBalance.length)}
            sub={`${fmt(depositRevenue)} collected`}
            accent="amber"
          />
          <SummaryCard
            label="Active"
            value={String(
              invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length
            )}
            sub={`${invoices.filter((i) => i.status === 'overdue').length} overdue`}
            accent={invoices.some((i) => i.status === 'overdue') ? 'red' : undefined}
          />
          <SummaryCard
            label="Draft"
            value={String(invoices.filter((i) => i.status === 'draft').length)}
            sub="not yet sent"
          />
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice #, client, amount…"
          className="flex-1"
        />
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'partial', label: 'Deposit Rcvd' },
              { key: 'paid', label: 'Paid' },
              { key: 'overdue', label: 'Overdue' },
              { key: 'draft', label: 'Draft' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`h-9 px-3 rounded-lg text-xs font-medium border transition whitespace-nowrap ${statusFilter === key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}
            >
              {label}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === key ? 'bg-white/20' : 'bg-zinc-100'}`}
              >
                {key === 'all'
                  ? invoices.length
                  : key === 'active'
                    ? invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length
                    : invoices.filter((i) => i.status === key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <svg
              className="w-10 h-10 mb-3 text-zinc-300"
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
          <div className="flex flex-col items-center justify-center py-14 text-zinc-400">
            <p className="text-sm">No invoices match your search.</p>
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-2 text-xs text-brand hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <SortTh
                  col="number"
                  active={sortCol}
                  dir={sortDir}
                  onSort={handleSort}
                  className="text-left px-4 py-3"
                >
                  Invoice #
                </SortTh>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Client</th>
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
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden md:table-cell w-40">
                  Project
                </th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pagedInvoices.map((inv, i) => {
                const client = clients.find((c) => c.id === inv.clientId);
                const sub = calcSubtotal(inv);
                const invDeposit =
                  inv.depositPercent != null ? sub * (inv.depositPercent / 100) : null;
                const invBalance = invDeposit != null ? sub - invDeposit : null;
                const status = (inv.status ?? 'draft') as InvoiceStatus;
                const sc = STATUS_CONFIG[status];
                const linkedProject = projects.find((p) => p.invoiceIds.includes(inv.id));
                const doneCount =
                  linkedProject?.items.filter((it) => it.status === 'done').length ?? 0;
                const totalItems = linkedProject?.items.length ?? 0;
                const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;

                return (
                  <tr
                    key={inv.id}
                    className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition ${i % 2 === 1 ? 'bg-zinc-50/30' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                      {inv.number}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 max-w-[120px] truncate">
                      {client?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap hidden sm:table-cell">
                      {inv.date}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="font-medium text-zinc-900">{fmt(sub)}</span>
                      {invBalance != null && (
                        <div className="flex flex-col items-end gap-0.5 mt-0.5">
                          <span className="text-xs text-zinc-400">
                            {fmt(invDeposit!)} dep · {fmt(invBalance)} bal
                          </span>
                        </div>
                      )}
                    </td>
                    {/* Project column */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {linkedProject ? (
                        <button
                          onClick={() => setViewProjectId(linkedProject.id)}
                          className="w-full text-left group"
                          title={`${linkedProject.name} — ${pct}%`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition truncate max-w-[96px]">
                              {linkedProject.name}
                            </span>
                            <span className="text-xs text-zinc-400 shrink-0">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`}
                              style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={() => openLinkProject(inv)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-brand transition group"
                        >
                          <svg
                            className="w-3 h-3 group-hover:scale-110 transition-transform"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Link project
                        </button>
                      )}
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
                              setInvoices(
                                invoices.map((i) =>
                                  i.id === inv.id ? { ...i, status: 'sent' } : i
                                )
                              );
                              window.open(`/invoices/${inv.id}`, '_blank');
                            }}
                            className="h-7 px-2.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition whitespace-nowrap"
                          >
                            Mark Sent
                          </button>
                        )}
                        {/* Mobile project button */}
                        <button
                          onClick={() =>
                            linkedProject
                              ? setViewProjectId(linkedProject.id)
                              : openLinkProject(inv)
                          }
                          className={`md:hidden p-1.5 rounded-md border transition ${linkedProject ? 'border-blue-200 text-blue-500 bg-blue-50 hover:bg-blue-100' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}
                          title={linkedProject ? linkedProject.name : 'Link project'}
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
                        <a
                          href={`/invoices/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition"
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
                          className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition"
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
                          className="p-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition"
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
        )}
      </div>

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
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 w-full md:max-w-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editingId ? 'Edit invoice' : 'New invoice'}
              </h2>
              <button onClick={closePanel} className="text-zinc-400 hover:text-zinc-700 transition">
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

              <PanelField label="Project / Campaign Name">
                <input
                  value={form.projectName ?? ''}
                  onChange={(e) => setField('projectName', e.target.value)}
                  className={inputCls}
                  placeholder="Citra Campaign"
                />
              </PanelField>

              {/* Client field + inline create */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">
                    Client <span className="text-red-500">*</span>
                  </label>
                  {!showClientForm && (
                    <button
                      onClick={() => {
                        setShowClientForm(true);
                        setField('clientId', '');
                      }}
                      className="flex items-center gap-0.5 text-xs text-brand hover:underline"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      New client
                    </button>
                  )}
                </div>
                {!showClientForm ? (
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
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                              {filtered.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-zinc-400">
                                  No clients found
                                </div>
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
                                    className={`w-full text-left px-3 py-2 hover:bg-zinc-50 transition ${form.clientId === c.id ? 'bg-amber-50' : ''}`}
                                  >
                                    <div className="text-sm font-medium text-zinc-900">
                                      {c.name}
                                    </div>
                                    {(c.contactPerson || c.email || c.phone) && (
                                      <div className="text-xs text-zinc-400 truncate">
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
                ) : (
                  <div className="rounded-xl border border-brand/50 bg-amber-50/50 p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                      Create new client
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">
                          Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={clientForm.name}
                          onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="ANYMIND (Cambodia) CO.,LTD"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">Contact Person (To)</label>
                        <input
                          value={clientForm.contactPerson}
                          onChange={(e) =>
                            setClientForm((p) => ({ ...p, contactPerson: e.target.value }))
                          }
                          placeholder="Mr. Siv Chinh"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">Email</label>
                        <input
                          type="email"
                          value={clientForm.email}
                          onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="billing@example.com"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">Phone</label>
                        <input
                          value={clientForm.phone}
                          onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+855 23 901 415"
                          className={inputCls}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">Address</label>
                        <input
                          value={clientForm.address}
                          onChange={(e) =>
                            setClientForm((p) => ({ ...p, address: e.target.value }))
                          }
                          placeholder="16/F, Phnom Penh Tower, No 445, St. Monivong, Phnom Penh, Cambodia"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    {clientFormError && <p className="text-xs text-red-600">{clientFormError}</p>}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setShowClientForm(false);
                          setClientForm(EMPTY_CLIENT_FORM);
                          setClientFormError('');
                        }}
                        className="h-8 px-3 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveNewClient}
                        className="h-8 px-3 rounded-lg bg-brand text-zinc-900 text-xs font-medium hover:bg-brand-hover transition"
                      >
                        Add &amp; select
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? `${sc.cls} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                      >
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              </PanelField>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-700">Line Items</span>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition"
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
                <div className="rounded-lg border border-zinc-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-px bg-zinc-200 text-xs font-medium text-zinc-500">
                    <div className="bg-zinc-50 px-3 py-2">Description</div>
                    <div className="bg-zinc-50 px-3 py-2 text-center">Qty</div>
                    <div className="bg-zinc-50 px-3 py-2 text-right">Unit Price</div>
                    <div className="bg-zinc-50 px-3 py-2 text-right">Total</div>
                    <div className="bg-zinc-50" />
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
                        className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-px bg-zinc-200 items-start"
                      >
                        <div className="bg-white flex flex-col gap-0">
                          {/* Title */}
                          <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={form.projectName || 'Project / event title…'}
                            className="px-3 pt-2.5 pb-2 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-zinc-50 w-full bg-transparent"
                          />
                          {/* Scope chips area */}
                          <div className="px-3 pb-2.5 border-t border-zinc-100">
                            {/* Added scope chips */}
                            {scopeLines.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2 pb-1.5">
                                {scopeLines.map((line) => (
                                  <span
                                    key={line}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-white text-xs font-medium"
                                  >
                                    {line}
                                    <button
                                      type="button"
                                      onClick={() => removeScopeLine(line)}
                                      className="ml-0.5 text-zinc-400 hover:text-white transition"
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
                                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 text-xs hover:bg-zinc-200 hover:text-zinc-800 transition"
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
                                className="flex-1 h-6 text-xs text-zinc-600 placeholder:text-zinc-300 focus:outline-none bg-transparent"
                              />
                              {customVal.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    addScopeLine(customVal);
                                    setCustomScope((prev) => ({ ...prev, [item.id]: '' }));
                                  }}
                                  className="text-xs text-zinc-400 hover:text-zinc-700 transition px-1"
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
                          className="bg-white px-3 py-2 text-sm text-center text-zinc-900 focus:outline-none focus:bg-zinc-50"
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                          }
                          className="bg-white px-3 py-2 text-sm text-right text-zinc-900 focus:outline-none focus:bg-zinc-50"
                        />
                        <div className="bg-white px-3 py-2 text-sm text-right text-zinc-700 font-medium">
                          {fmt(item.qty * item.unitPrice)}
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={form.items.length === 1}
                          className="bg-white flex items-center justify-center text-zinc-300 hover:text-red-500 disabled:opacity-0 transition pt-2.5"
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
                  <div className="flex gap-8 pt-1.5 border-t border-zinc-200">
                    <span className="font-semibold text-zinc-700">Grand Total</span>
                    <span className="font-bold text-zinc-900 w-28 text-right">{fmt(subtotal)}</span>
                  </div>
                  {form.withWHT && (
                    <>
                      <div className="flex gap-8 text-orange-700">
                        <span>Less WHT {WHT_RATE * 100}%</span>
                        <span className="font-medium w-28 text-right">({fmt(whtAmount)})</span>
                      </div>
                      <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5">
                        <span className="font-semibold text-zinc-700">Total (USD)</span>
                        <span className="font-bold text-zinc-900 w-28 text-right">
                          {fmt(netTotal)}
                        </span>
                      </div>
                    </>
                  )}
                  {form.depositPercent != null && (
                    <>
                      <div className="flex gap-8 text-green-700">
                        <span>Deposit ({form.depositPercent}%)</span>
                        <span className="font-medium w-28 text-right">− {fmt(depositAmount)}</span>
                      </div>
                      <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5">
                        <span className="font-semibold text-zinc-700">Balance Due</span>
                        <span className="font-bold text-zinc-900 w-28 text-right">
                          {fmt(balanceDue)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* WHT toggle */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-orange-50 border border-orange-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">Withholding Tax (WHT 15%)</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    Gross-up unit prices so the client withholds 15% and you receive the deal
                    amount.
                  </p>
                  {form.withWHT && (
                    <p className="text-xs text-orange-700 mt-2 font-medium">
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
              <div className="flex items-start gap-4 p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Deposit / Partial Payment</p>
                  <p className="text-xs text-green-600 mt-0.5">
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
                        className="w-16 h-8 rounded-md border border-green-300 px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-center"
                      />
                      <span className="text-sm text-green-700">
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

            <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between shrink-0">
              {formError ? <p className="text-sm text-red-600">{formError}</p> : <span />}
              <div className="flex gap-3">
                <button
                  onClick={closePanel}
                  className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
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
        <ModalShell onClose={() => setDeleteId(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Delete invoice?</h2>
            <p className="text-sm text-zinc-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Link / Create project ───────────────────────────────────────────────── */}
      {linkProjectInvId &&
        (() => {
          const inv = invoices.find((i) => i.id === linkProjectInvId);
          const client = inv ? clients.find((c) => c.id === inv.clientId) : null;
          const clientProjects = inv
            ? projects.filter((p) => p.clientId === inv.clientId && !p.invoiceIds.includes(inv.id))
            : [];
          return (
            <ModalShell onClose={() => setLinkProjectInvId(null)}>
              <div className="flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">Link project</h2>
                    {inv && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {inv.number} · {client?.name ?? '—'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setLinkProjectInvId(null)}
                    className="text-zinc-400 hover:text-zinc-700 transition"
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

                {clientProjects.length > 0 && (
                  <div className="flex border-b border-zinc-200 shrink-0">
                    {(['link', 'create'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setCpMode(m)}
                        className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition ${cpMode === m ? 'border-brand text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                      >
                        {m === 'link' ? 'Link existing' : 'Create new'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                  {cpMode === 'link' && clientProjects.length > 0 ? (
                    <>
                      <p className="text-sm text-zinc-500">
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
                              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${cpLinkId === p.id ? 'border-brand bg-amber-50/40' : 'border-zinc-200 hover:border-zinc-300'}`}
                            >
                              <input
                                type="radio"
                                name="linkProject"
                                value={p.id}
                                checked={cpLinkId === p.id}
                                onChange={() => setCpLinkId(p.id)}
                                className="text-brand"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900">{p.name}</p>
                                {total > 0 && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-zinc-400 shrink-0">{pct}%</span>
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
                        <label className="text-sm font-medium text-zinc-700">Project name</label>
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
                            className="self-start text-xs text-brand hover:underline"
                          >
                            Use &quot;{client.name}&quot;
                          </button>
                        )}
                      </div>
                      {cpItems.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-zinc-700">
                            Scope items from invoice
                          </label>
                          <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-3 max-h-48 overflow-y-auto">
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
                                  className="rounded border-zinc-300 text-brand focus:ring-brand"
                                />
                                <span
                                  className={`text-sm ${cpExcluded.has(item.id) ? 'line-through text-zinc-400' : 'text-zinc-700'}`}
                                >
                                  {item.description}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-zinc-400">
                            Uncheck items to exclude from project.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-zinc-100 justify-end shrink-0">
                  <button
                    onClick={() => setLinkProjectInvId(null)}
                    className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!inv) return;
                      if (cpMode === 'link' && cpLinkId) {
                        setProjects(
                          projects.map((p) =>
                            p.id === cpLinkId ? { ...p, invoiceIds: [...p.invoiceIds, inv.id] } : p
                          )
                        );
                      } else {
                        const name = cpName.trim() || (client?.name ?? 'New Project');
                        setProjects([
                          ...projects,
                          {
                            id: uid(),
                            name,
                            clientId: inv.clientId,
                            invoiceIds: [inv.id],
                            items: cpItems.filter((it) => !cpExcluded.has(it.id)),
                            status: 'active',
                            createdAt: new Date().toISOString(),
                          },
                        ]);
                      }
                      setLinkProjectInvId(null);
                      setCpName('');
                      setCpItems([]);
                      setCpExcluded(new Set());
                      setCpLinkId('');
                    }}
                    className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
                  >
                    {cpMode === 'link' ? 'Link project' : 'Create project'}
                  </button>
                </div>
              </div>
            </ModalShell>
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
      <label className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
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
}: {
  label: string;
  value: string;
  sub: string;
  accent?: 'amber' | 'red';
}) {
  const subCls =
    accent === 'red' ? 'text-red-500' : accent === 'amber' ? 'text-amber-600' : 'text-zinc-500';
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className={`text-xs mt-0.5 ${subCls}`}>{sub}</p>
    </div>
  );
}
