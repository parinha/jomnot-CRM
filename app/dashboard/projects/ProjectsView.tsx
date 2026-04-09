'use client';

import { useState, useRef } from 'react';
import {
  useStore,
  type Project,
  type ProjectItem,
  type ProjectItemStatus,
  type ProjectStatus,
  type Client,
} from '../AppStore';
import {
  PROJECT_STATUS_CONFIG,
  ITEM_STATUS_CONFIG,
  ITEM_STATUS_NEXT,
} from '@/app/_config/statusConfig';
import { uid } from '@/app/_lib/id';
import { PAGE_SIZE } from '@/app/_config/constants';
import SearchInput from '@/app/_components/SearchInput';
import Pagination from '@/app/_components/Pagination';
import SortTh from '@/app/_components/SortTh';
import ModalShell from '@/app/_components/ModalShell';
import ConfirmDeleteModal from '@/app/_components/ConfirmDeleteModal';
import InvoicePreviewModal from '@/app/_components/InvoicePreviewModal';

type ProjectFormState = Omit<Project, 'id' | 'createdAt'>;
function blankForm(): ProjectFormState {
  return {
    name: '',
    clientId: '',
    invoiceIds: [],
    items: [],
    status: 'draft',
    filmingDate: '',
    deliverDate: '',
    budget: undefined,
  };
}

// ── Timeline helper ────────────────────────────────────────────────────────────
type TimelineBadge = {
  label: string;
  cls: string;
};

function getTimelineBadge(filmingDate?: string, deliverDate?: string): TimelineBadge | null {
  if (!deliverDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Show filming countdown if filming hasn't started yet
  if (filmingDate) {
    const filming = new Date(filmingDate);
    filming.setHours(0, 0, 0, 0);
    if (today < filming) {
      const daysLeft = Math.round((filming.getTime() - today.getTime()) / 86400000);
      if (daysLeft === 0) return { label: 'Today', cls: 'bg-red-500/20 text-red-400' };
      if (daysLeft >= 5) {
        return { label: `${daysLeft}d till filming`, cls: 'bg-sky-500/20 text-sky-300' };
      }
      return { label: `Only ${daysLeft}d left`, cls: 'bg-amber-500/20 text-amber-300' };
    }
  }

  // Delivery countdown / overdue
  const deliver = new Date(deliverDate);
  deliver.setHours(0, 0, 0, 0);

  if (today <= deliver) {
    const daysLeft = Math.round((deliver.getTime() - today.getTime()) / 86400000);
    if (daysLeft === 0) return { label: 'Today', cls: 'bg-red-500/20 text-red-400' };
    if (daysLeft > 5) {
      return { label: `${daysLeft}d to go`, cls: 'bg-emerald-500/20 text-emerald-300' };
    }
    return { label: `Only ${daysLeft}d left`, cls: 'bg-amber-500/20 text-amber-300' };
  }

  const daysLate = Math.round((today.getTime() - deliver.getTime()) / 86400000);
  return { label: `Late ${daysLate}d ago`, cls: 'bg-red-500/20 text-red-400' };
}

const inputCls =
  'h-11 rounded-xl border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full bg-white';
const darkInputCls =
  'h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full';

const EMPTY_CLIENT_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };
const FALLBACK_STATUS_CFG = { label: 'Unknown', cls: 'bg-zinc-100 text-zinc-500' };
function getStatusCfg(status: string) {
  return PROJECT_STATUS_CONFIG[status as ProjectStatus] ?? FALLBACK_STATUS_CFG;
}

export default function ProjectsView() {
  const { clients, setClients, invoices, projects, setProjects, scopeOfWork, paymentInfo } =
    useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(blankForm());
  const [newItemText, setNewItemText] = useState('');
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewClientId, setViewClientId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(col: string) {
    if (col === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  // Client combobox
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  // Inline client create
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientFormError, setClientFormError] = useState('');

  // ── Telegram ────────────────────────────────────────────────────────────────
  const [sendingTelegram, setSendingTelegram] = useState<string | null>(null);

  async function sendProjectToTelegram(project: Project) {
    const token = paymentInfo.telegramBotToken?.trim();
    const chatId = paymentInfo.projectTelegramChatId?.trim();
    if (!token || !chatId) {
      alert('Add your Telegram Bot Token and Project Chat ID in Settings first.');
      return;
    }
    setSendingTelegram(project.id);
    try {
      const client = clients.find((c) => c.id === project.clientId);
      const done = project.items.filter((it) => it.status === 'done').length;
      const scopeLines = project.items
        .map(
          (it) =>
            `${it.status === 'done' ? '✅' : it.status === 'in-progress' ? '🔄' : '⬜'} ${it.description}`
        )
        .join('\n');
      const text = [
        `📁 *${project.name}*`,
        `👤 Client: ${client?.name ?? '—'}`,
        `📊 Status: ${project.status}`,
        `📋 Progress: ${done}/${project.items.length} done`,
        scopeLines ? `\n${scopeLines}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('text', text);
      formData.append('parse_mode', 'Markdown');
      if (paymentInfo.projectTelegramTopicId?.trim()) {
        formData.append('message_thread_id', paymentInfo.projectTelegramTopicId.trim());
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const client = clients.find((c) => c.id === p.clientId);
    const invNums = p.invoiceIds
      .map((id) => invoices.find((i) => i.id === id)?.number ?? '')
      .join(' ');
    return (
      p.name.toLowerCase().includes(q) ||
      (client?.name ?? '').toLowerCase().includes(q) ||
      invNums.toLowerCase().includes(q)
    );
  });

  const STATUS_ORDER: Record<string, number> = {
    draft: 0,
    confirmed: 1,
    'in-progress': 2,
    'on-hold': 3,
    completed: 4,
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortCol === 'client') {
      const ca = clients.find((c) => c.id === a.clientId)?.name ?? '';
      const cb = clients.find((c) => c.id === b.clientId)?.name ?? '';
      cmp = ca.localeCompare(cb);
    } else if (sortCol === 'invoices') {
      cmp = a.invoiceIds.length - b.invoiceIds.length;
    } else if (sortCol === 'budget') {
      cmp = (a.budget ?? 0) - (b.budget ?? 0);
    } else if (sortCol === 'timeline') {
      const da = a.deliverDate ?? '';
      const db = b.deliverDate ?? '';
      if (!da && !db) cmp = 0;
      else if (!da) cmp = 1;
      else if (!db) cmp = -1;
      else cmp = da.localeCompare(db);
    } else if (sortCol === 'status') {
      cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetClientCombo() {
    setClientSearch('');
    setClientDropOpen(false);
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
  }

  function openAdd() {
    setEditingId(null);
    setForm(blankForm());
    setNewItemText('');
    setFormError('');
    resetClientCombo();
    setModalOpen(true);
  }
  function openEdit(project: Project) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      clientId: project.clientId,
      invoiceIds: [...project.invoiceIds],
      items: project.items.map((it) => ({ ...it })),
      status: project.status,
      filmingDate: project.filmingDate ?? '',
      deliverDate: project.deliverDate ?? '',
      budget: project.budget,
    });
    setNewItemText('');
    setFormError('');
    resetClientCombo();
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(blankForm());
    setNewItemText('');
    setFormError('');
    resetClientCombo();
  }

  function saveNewClient() {
    if (!clientForm.name.trim()) {
      setClientFormError('Name is required.');
      return;
    }
    const newClient: Client = { id: uid(), ...clientForm };
    setClients([...clients, newClient]);
    handleClientChange(newClient.id);
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
  }

  const selectedClient = clients.find((c) => c.id === form.clientId);

  function handleClientChange(clientId: string) {
    setForm((prev) => {
      const items =
        prev.items.length === 0 && clientId
          ? scopeOfWork.map((desc) => ({
              id: uid(),
              description: desc,
              status: 'todo' as ProjectItemStatus,
            }))
          : prev.items;
      const clientInvoiceIds = invoices.filter((i) => i.clientId === clientId).map((i) => i.id);
      return {
        ...prev,
        clientId,
        items,
        invoiceIds: prev.invoiceIds.filter((id) => clientInvoiceIds.includes(id)),
      };
    });
  }

  function toggleInvoice(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId);
    setForm((prev) => {
      if (prev.invoiceIds.includes(invoiceId))
        return { ...prev, invoiceIds: prev.invoiceIds.filter((id) => id !== invoiceId) };
      const newItems: ProjectItem[] = [];
      if (inv) {
        for (const lineItem of inv.items) {
          const lines = lineItem.description
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
          const scopeLines = lines.length > 1 ? lines.slice(1) : lines;
          for (const line of scopeLines) {
            if (!prev.items.some((it) => it.description === line)) {
              newItems.push({ id: uid(), description: line, status: 'todo' as ProjectItemStatus });
            }
          }
        }
      }
      return {
        ...prev,
        invoiceIds: [...prev.invoiceIds, invoiceId],
        items: [...prev.items, ...newItems],
      };
    });
  }

  function addScopeItem() {
    const text = newItemText.trim();
    if (!text) return;
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), description: text, status: 'todo' }],
    }));
    setNewItemText('');
  }

  function removeItem(itemId: string) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== itemId) }));
  }
  function cycleItemStatus(itemId: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, status: ITEM_STATUS_NEXT[it.status] } : it
      ),
    }));
  }

  function saveProject(): Project | null {
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return null;
    }
    if (!form.clientId) {
      setFormError('Please select a client.');
      return null;
    }
    const cleanedForm = {
      ...form,
      filmingDate: form.filmingDate?.trim() || undefined,
      deliverDate: form.deliverDate?.trim() || undefined,
      budget: form.budget && form.budget > 0 ? form.budget : undefined,
    };
    if (editingId) {
      const existing = projects.find((p) => p.id === editingId)!;
      const updated = { ...existing, ...cleanedForm };
      setProjects(projects.map((p) => (p.id === editingId ? updated : p)));
      return updated;
    } else {
      const created: Project = { id: uid(), createdAt: new Date().toISOString(), ...cleanedForm };
      setProjects([...projects, created]);
      return created;
    }
  }

  function handleSave() {
    if (saveProject()) closeModal();
  }

  async function handleSaveAndSend() {
    const project = saveProject();
    if (!project) return;
    closeModal();
    await sendProjectToTelegram(project);
  }

  function handleDelete(id: string) {
    setProjects(projects.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  function cycleDetailItemStatus(projectId: string, itemId: string) {
    setProjects(
      projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          items: p.items.map((it) =>
            it.id === itemId ? { ...it, status: ITEM_STATUS_NEXT[it.status] } : it
          ),
        };
      })
    );
  }

  const detailProject = projects.find((p) => p.id === detailId);
  const clientInvoices = form.clientId ? invoices.filter((i) => i.clientId === form.clientId) : [];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-white/45 mt-0.5">{projects.length} total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 active:bg-amber-500 transition shadow-lg shadow-amber-500/20"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New project
        </button>
      </div>

      {/* Summary widgets */}
      {(() => {
        const fmt = (n: number) => (n === 0 ? '—' : `$${n.toLocaleString()}`);
        const total = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
        const earned = projects
          .filter((p) => p.status === 'completed')
          .reduce((s, p) => s + (p.budget ?? 0), 0);
        const outstanding = projects
          .filter((p) => p.status === 'confirmed' || p.status === 'in-progress')
          .reduce((s, p) => s + (p.budget ?? 0), 0);
        const awaitConfirm = projects
          .filter((p) => p.status === 'draft')
          .reduce((s, p) => s + (p.budget ?? 0), 0);
        const widgets = [
          {
            label: 'Total Payment',
            value: fmt(total),
            sub: `${projects.length} projects`,
            color: 'text-white',
          },
          {
            label: 'Total Earned',
            value: fmt(earned),
            sub: `${projects.filter((p) => p.status === 'completed').length} completed`,
            color: 'text-emerald-400',
          },
          {
            label: 'Outstanding',
            value: fmt(outstanding),
            sub: `${projects.filter((p) => p.status === 'confirmed' || p.status === 'in-progress').length} active`,
            color: 'text-sky-400',
          },
          {
            label: 'Await Confirm',
            value: fmt(awaitConfirm),
            sub: `${projects.filter((p) => p.status === 'draft').length} drafts`,
            color: 'text-amber-400',
          },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {widgets.map((w) => (
              <div
                key={w.label}
                className="rounded-2xl border border-white/[0.09] bg-white/[0.05] backdrop-blur-xl p-4"
              >
                <p className={`text-xl font-bold ${w.color}`}>{w.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{w.sub}</p>
                <p className="text-xs text-white/55 mt-1">{w.label}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, client, invoice…"
          className="flex-1"
        />
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'draft', 'confirmed', 'in-progress', 'on-hold', 'completed'] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => {
                  setStatusFilter(f);
                  setPage(1);
                }}
                className={`h-11 px-4 rounded-xl text-xs font-semibold border transition whitespace-nowrap ${statusFilter === f ? 'bg-[#FFC206] text-zinc-900 border-[#FFC206]' : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/[0.14]'}`}
              >
                {f === 'all' ? 'All' : PROJECT_STATUS_CONFIG[f].label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Empty states */}
      {projects.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl flex flex-col items-center justify-center py-20 text-white/35">
          <svg
            className="w-12 h-12 mb-3 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
          </svg>
          <p className="text-sm">No projects yet. Create your first one.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl flex flex-col items-center justify-center py-14 text-white/35">
          <p className="text-sm">No projects match your filters.</p>
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
          {/* Mobile card list */}
          <div className="sm:hidden flex flex-col gap-3">
            {paged.map((project) => {
              const client = clients.find((c) => c.id === project.clientId);
              const doneCount = project.items.filter((it) => it.status === 'done').length;
              const totalItems = project.items.length;
              const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
              const sc = getStatusCfg(project.status);
              return (
                <div
                  key={project.id}
                  className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setDetailId(project.id)}
                        className="font-bold text-white text-left truncate hover:text-[#FFC206] transition block w-full"
                      >
                        {project.name}
                      </button>
                      <p className="text-xs text-white/45 mt-0.5">
                        {client ? (
                          <button
                            onClick={() => setViewClientId(client.id)}
                            className="hover:text-[#FFC206] transition"
                          >
                            {client.name}
                          </button>
                        ) : (
                          '—'
                        )}
                        {project.budget ? (
                          <span className="text-white/30">
                            {' '}
                            · ${project.budget.toLocaleString()}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
                        {sc.label}
                      </span>
                      {(() => {
                        const badge = getTimelineBadge(project.filmingDate, project.deliverDate);
                        return badge ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  {totalItems > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                        <span>
                          {doneCount}/{totalItems} tasks
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#FFC206] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailId(project.id)}
                      className="flex-1 h-9 rounded-xl border border-white/15 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white transition"
                    >
                      View Scope
                    </button>
                    <button
                      onClick={() => openEdit(project)}
                      className="h-9 px-3 rounded-xl border border-white/20 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(project.id)}
                      className="h-9 px-3 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition"
                    >
                      Del
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                  <SortTh
                    col="name"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5"
                  >
                    Project
                  </SortTh>
                  <SortTh
                    col="client"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5 hidden sm:table-cell"
                  >
                    Client
                  </SortTh>
                  <SortTh
                    col="invoices"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5 hidden md:table-cell"
                  >
                    Invoice(s)
                  </SortTh>
                  <th className="text-left px-4 py-3.5 font-medium text-white/45 hidden sm:table-cell">
                    Progress
                  </th>
                  <SortTh
                    col="budget"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5 hidden md:table-cell"
                  >
                    Budget
                  </SortTh>
                  <SortTh
                    col="timeline"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5 hidden lg:table-cell"
                  >
                    Timeline
                  </SortTh>
                  <SortTh
                    col="status"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5"
                  >
                    Status
                  </SortTh>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {paged.map((project, i) => {
                  const client = clients.find((c) => c.id === project.clientId);
                  const linkedInvoices = project.invoiceIds
                    .map((id) => invoices.find((inv) => inv.id === id))
                    .filter(Boolean);
                  const doneCount = project.items.filter((it) => it.status === 'done').length;
                  const totalItems = project.items.length;
                  const sc = getStatusCfg(project.status);
                  return (
                    <tr
                      key={project.id}
                      className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setDetailId(project.id)}
                          className="font-semibold text-white hover:text-[#FFC206] transition text-left"
                        >
                          {project.name}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        {client ? (
                          <button
                            onClick={() => setViewClientId(client.id)}
                            className="text-white/60 hover:text-[#FFC206] transition text-left"
                          >
                            {client.name}
                          </button>
                        ) : (
                          <span className="text-white/25">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {linkedInvoices.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {linkedInvoices.map(
                              (inv) =>
                                inv && (
                                  <button
                                    key={inv.id}
                                    onClick={() => setViewInvoiceId(inv.id)}
                                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/60 hover:bg-[#FFC206]/20 hover:text-[#FFC206] transition"
                                  >
                                    {inv.number}
                                  </button>
                                )
                            )}
                          </div>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        {totalItems > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#FFC206] transition-all"
                                style={{ width: `${(doneCount / totalItems) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-white/50">
                              {doneCount}/{totalItems}
                            </span>
                          </div>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {project.budget ? (
                          <span className="text-sm text-white/80">
                            ${project.budget.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {(() => {
                          const badge = getTimelineBadge(project.filmingDate, project.deliverDate);
                          return badge ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          ) : (
                            <span className="text-white/25 text-xs">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailId(project.id)}
                            className="p-2.5 rounded-xl border border-white/15 text-white/50 hover:bg-white/10 hover:text-white transition"
                            title="View scope"
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
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEdit(project)}
                            className="p-2.5 rounded-xl border border-white/15 text-white/50 hover:bg-white/10 hover:text-white transition"
                            title="Edit"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => sendProjectToTelegram(project)}
                            disabled={sendingTelegram === project.id}
                            className="p-2.5 rounded-xl border border-white/15 text-sky-400 hover:bg-white/10 transition disabled:opacity-50"
                            title="Send to Telegram"
                          >
                            {sendingTelegram === project.id ? (
                              <svg
                                className="w-4 h-4 animate-spin"
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
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteId(project.id)}
                            className="p-2.5 rounded-xl border border-red-500/25 text-red-400 hover:bg-red-500/15 transition"
                            title="Delete"
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
        totalItems={sorted.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Detail modal */}
      {detailProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDetailId(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">{detailProject.name}</h2>
                <p className="text-sm text-white/45 mt-0.5">
                  {clients.find((c) => c.id === detailProject.clientId)?.name ?? '—'}
                  {detailProject.invoiceIds.length > 0 && (
                    <span className="text-white/30">
                      {' '}
                      ·{' '}
                      {detailProject.invoiceIds
                        .map((id) => invoices.find((i) => i.id === id)?.number)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusCfg(detailProject.status).cls}`}
                >
                  {getStatusCfg(detailProject.status).label}
                </span>
                <button
                  onClick={() => {
                    setDetailId(null);
                    openEdit(detailProject);
                  }}
                  className="h-9 px-4 rounded-xl border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/15 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDetailId(null)}
                  className="p-2.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
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
            {(detailProject.filmingDate || detailProject.deliverDate) && (
              <div className="px-6 py-3 border-b border-white/[0.08] flex gap-4 shrink-0">
                {detailProject.filmingDate && (
                  <div>
                    <p className="text-xs text-white/35">Filming</p>
                    <p className="text-sm font-semibold text-white">{detailProject.filmingDate}</p>
                  </div>
                )}
                {detailProject.deliverDate && (
                  <div>
                    <p className="text-xs text-white/35">Deliver</p>
                    <p className="text-sm font-semibold text-white">{detailProject.deliverDate}</p>
                  </div>
                )}
                {(() => {
                  const badge = getTimelineBadge(
                    detailProject.filmingDate,
                    detailProject.deliverDate
                  );
                  return badge ? (
                    <div className="ml-auto flex items-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailProject.items.length === 0 ? (
                <p className="text-sm text-white/35 text-center py-8">
                  No scope items. Edit project to add them.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white/70">Scope of Work</p>
                    <p className="text-xs text-white/40">
                      {detailProject.items.filter((it) => it.status === 'done').length}/
                      {detailProject.items.length} done
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {detailProject.items.map((item) => {
                      const cfg = ITEM_STATUS_CONFIG[item.status];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] transition"
                        >
                          <button
                            onClick={() => cycleDetailItemStatus(detailProject.id, item.id)}
                            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition hover:opacity-80 ${cfg.cls}`}
                            title="Click to cycle status"
                          >
                            {cfg.label}
                          </button>
                          <span
                            className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}
                          >
                            {item.description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/45">Overall progress</span>
                      <span className="text-xs font-semibold text-white/70">
                        {Math.round(
                          (detailProject.items.filter((it) => it.status === 'done').length /
                            detailProject.items.length) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FFC206] transition-all"
                        style={{
                          width: `${(detailProject.items.filter((it) => it.status === 'done').length / detailProject.items.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-3.5 border-t border-white/[0.08] shrink-0">
              <p className="text-xs text-white/30">
                Tap status badge to cycle: To Do → In Progress → Done
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit project' : 'New project'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
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
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Client */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                    Client *
                  </label>
                  {!showClientForm && (
                    <button
                      onClick={() => {
                        setShowClientForm(true);
                        handleClientChange('');
                      }}
                      className="flex items-center gap-0.5 text-xs text-[#FFC206] hover:underline"
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
                            [c.name, c.contactPerson ?? '', c.phone, c.email].some((f) =>
                              f.toLowerCase().includes(q)
                            )
                          )
                        : clients;
                      return (
                        <>
                          <input
                            value={clientDropOpen ? clientSearch : (selected?.name ?? '')}
                            onChange={(e) => {
                              setClientSearch(e.target.value);
                              setClientDropOpen(true);
                              if (!e.target.value) handleClientChange('');
                            }}
                            onFocus={() => {
                              setClientSearch('');
                              setClientDropOpen(true);
                            }}
                            onBlur={() => setTimeout(() => setClientDropOpen(false), 150)}
                            placeholder="Search clients…"
                            className={darkInputCls}
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
                                      handleClientChange(c.id);
                                      setClientSearch('');
                                      setClientDropOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-white/10 transition ${form.clientId === c.id ? 'bg-[#FFC206]/10' : ''}`}
                                  >
                                    <div className="text-sm font-medium text-white">{c.name}</div>
                                    {(c.contactPerson || c.email) && (
                                      <div className="text-xs text-white/40 truncate">
                                        {[c.contactPerson, c.email].filter(Boolean).join(' · ')}
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
                  <div className="rounded-xl border border-[#FFC206]/30 bg-white/[0.05] p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                      Create new client
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/50">Company Name *</label>
                        <input
                          value={clientForm.name}
                          onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="ANYMIND CO., LTD"
                          className={darkInputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/50">Contact Person</label>
                        <input
                          value={clientForm.contactPerson}
                          onChange={(e) =>
                            setClientForm((p) => ({ ...p, contactPerson: e.target.value }))
                          }
                          placeholder="Mr. Smith"
                          className={darkInputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/50">Email</label>
                        <input
                          type="email"
                          value={clientForm.email}
                          onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="billing@example.com"
                          className={darkInputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/50">Phone</label>
                        <input
                          value={clientForm.phone}
                          onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+855 12 345 678"
                          className={darkInputCls}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-xs text-white/50">Address</label>
                        <input
                          value={clientForm.address}
                          onChange={(e) =>
                            setClientForm((p) => ({ ...p, address: e.target.value }))
                          }
                          placeholder="123 Street, City"
                          className={darkInputCls}
                        />
                      </div>
                    </div>
                    {clientFormError && <p className="text-xs text-red-400">{clientFormError}</p>}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setShowClientForm(false);
                          setClientForm(EMPTY_CLIENT_FORM);
                          setClientFormError('');
                        }}
                        className="h-9 px-3 rounded-xl border border-white/20 text-xs text-white/60 hover:bg-white/10 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveNewClient}
                        className="h-9 px-3 rounded-xl bg-[#FFC206] text-zinc-900 text-xs font-bold hover:bg-amber-400 transition"
                      >
                        Add &amp; select
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={
                    selectedClient
                      ? `${selectedClient.name} — Project`
                      : 'e.g. Wedding Video Package'
                  }
                  className={darkInputCls}
                />
                {selectedClient && !form.name && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setForm((p) => ({ ...p, name: selectedClient.name }))}
                      className="text-xs text-[#FFC206] hover:underline"
                    >
                      Use &quot;{selectedClient.name}&quot;
                    </button>
                    <span className="text-xs text-white/25">·</span>
                    <button
                      onClick={() =>
                        setForm((p) => ({ ...p, name: `${selectedClient.name} Project` }))
                      }
                      className="text-xs text-[#FFC206] hover:underline"
                    >
                      Use &quot;{selectedClient.name} Project&quot;
                    </button>
                  </div>
                )}
              </div>
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Status
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((s) => {
                    const cfg = PROJECT_STATUS_CONFIG[s];
                    const active = form.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setForm((p) => ({ ...p, status: s }))}
                        className={`h-9 px-4 rounded-xl text-xs font-semibold border transition ${active ? `${cfg.cls} border-current` : 'border-white/20 text-white/50 hover:bg-white/10'}`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Budget */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Budget
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.budget ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        budget: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                    placeholder="0"
                    className={`${darkInputCls} pl-7`}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Schedule
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/45">
                      Filming Date <span className="text-white/25">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={form.filmingDate ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, filmingDate: e.target.value }))}
                      className={`${darkInputCls} [color-scheme:dark]`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/45">Deliver Date *</label>
                    <input
                      type="date"
                      value={form.deliverDate ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, deliverDate: e.target.value }))}
                      min={form.filmingDate ?? undefined}
                      className={`${darkInputCls} [color-scheme:dark]`}
                    />
                  </div>
                </div>
              </div>

              {/* Linked invoices */}
              {clientInvoices.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                    Linked Invoice(s)
                  </label>
                  <div className="flex flex-col gap-1 rounded-xl border border-white/[0.1] p-3 bg-white/[0.04]">
                    {clientInvoices.map((inv) => (
                      <label
                        key={inv.id}
                        className="flex items-center gap-3 cursor-pointer py-1.5 px-1 rounded-lg hover:bg-white/[0.06] transition"
                      >
                        <input
                          type="checkbox"
                          checked={form.invoiceIds.includes(inv.id)}
                          onChange={() => toggleInvoice(inv.id)}
                          className="rounded border-white/30 text-amber-500 focus:ring-amber-500 w-4 h-4 bg-white/10"
                        />
                        <span className="text-sm text-white/80 font-medium">{inv.number}</span>
                        <span className="text-xs text-white/40">{inv.date}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {/* Scope items */}
              <div className="relative">
                {!form.clientId && (
                  <div className="absolute inset-0 z-10 rounded-xl bg-slate-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border border-white/[0.08]">
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
                    <p className="text-xs text-white/40 text-center px-4">Select a client first</p>
                  </div>
                )}
                <div className={!form.clientId ? 'pointer-events-none select-none opacity-30' : ''}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                        Scope of Work
                      </label>
                      {form.items.length > 0 && (
                        <span className="text-xs text-white/40">
                          {form.items.filter((it) => it.status === 'done').length}/
                          {form.items.length} done
                        </span>
                      )}
                    </div>
                    {form.items.length === 0 && form.clientId && (
                      <button
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            items: scopeOfWork.map((desc) => ({
                              id: uid(),
                              description: desc,
                              status: 'todo' as ProjectItemStatus,
                            })),
                          }))
                        }
                        className="self-start text-xs text-amber-600 hover:underline"
                      >
                        Load from global scope list
                      </button>
                    )}
                    {form.items.length > 0 && (
                      <div className="rounded-xl border border-white/[0.1] overflow-hidden">
                        {form.items.map((item, idx) => {
                          const cfg = ITEM_STATUS_CONFIG[item.status];
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 px-3 py-2.5 ${idx !== form.items.length - 1 ? 'border-b border-white/[0.06]' : ''} hover:bg-white/[0.04] transition`}
                            >
                              <button
                                onClick={() => cycleItemStatus(item.id)}
                                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition hover:opacity-75 ${cfg.cls}`}
                                title="Click to cycle status"
                              >
                                {cfg.label}
                              </button>
                              <span
                                className={`text-sm flex-1 min-w-0 ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}
                              >
                                {item.description}
                              </span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition"
                                title="Remove"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addScopeItem();
                          }
                        }}
                        placeholder="Add scope item… (Enter)"
                        list="scope-suggestions-proj"
                        className={`${darkInputCls} flex-1`}
                      />
                      <datalist id="scope-suggestions-proj">
                        {scopeOfWork.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                      <button
                        onClick={addScopeItem}
                        className="h-11 px-4 rounded-xl bg-white/10 text-sm font-semibold text-white/70 hover:bg-white/15 transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {formError && <p className="px-6 py-2 text-sm text-red-400 shrink-0">{formError}</p>}
            <div className="flex flex-col gap-2 px-6 py-4 border-t border-white/[0.08] shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 h-11 rounded-xl border border-white/20 text-sm font-medium text-white/70 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 h-11 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition"
                >
                  {editingId ? 'Save changes' : 'Create project'}
                </button>
              </div>
              <button
                onClick={handleSaveAndSend}
                disabled={sendingTelegram !== null}
                className="w-full h-11 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 text-sm font-semibold hover:bg-sky-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingTelegram !== null ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
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
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    {editingId ? 'Save & Send to Telegram' : 'Create & Send to Telegram'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <ConfirmDeleteModal
          title="Delete project?"
          description="This will permanently delete the project and its scope items."
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}

      {/* Invoice preview */}
      {viewInvoiceId && (
        <InvoicePreviewModal invId={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />
      )}

      {/* Client detail popup */}
      {viewClientId &&
        (() => {
          const c = clients.find((cl) => cl.id === viewClientId);
          if (!c) return null;
          const clientInvs = invoices.filter((inv) => inv.clientId === c.id);
          const clientProjs = projects.filter((p) => p.clientId === c.id);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setViewClientId(null)}
              />
              <div className="relative z-10 w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white">{c.name}</h2>
                    {c.contactPerson && (
                      <p className="text-sm text-white/45 mt-0.5">{c.contactPerson}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setViewClientId(null)}
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
                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
                  {/* Contact info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {c.phone && (
                      <div>
                        <p className="text-xs text-white/35 mb-0.5">Phone</p>
                        <p className="text-white/80">{c.phone}</p>
                      </div>
                    )}
                    {c.email && (
                      <div>
                        <p className="text-xs text-white/35 mb-0.5">Email</p>
                        <p className="text-white/80 break-all">{c.email}</p>
                      </div>
                    )}
                    {c.address && (
                      <div className="col-span-2">
                        <p className="text-xs text-white/35 mb-0.5">Address</p>
                        <p className="text-white/80">{c.address}</p>
                      </div>
                    )}
                    {c.vat_tin && (
                      <div>
                        <p className="text-xs text-white/35 mb-0.5">VAT / TIN</p>
                        <p className="text-white/80">{c.vat_tin}</p>
                      </div>
                    )}
                    {c.note && (
                      <div className="col-span-2">
                        <p className="text-xs text-white/35 mb-0.5">Note</p>
                        <p className="text-white/60 whitespace-pre-wrap">{c.note}</p>
                      </div>
                    )}
                  </div>
                  {/* Projects */}
                  {clientProjs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/35 uppercase tracking-wide mb-2">
                        Projects ({clientProjs.length})
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {clientProjs.map((p) => {
                          const cfg = getStatusCfg(p.status);
                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2"
                            >
                              <span className="text-sm text-white/80 truncate">{p.name}</span>
                              <span
                                className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}
                              >
                                {cfg.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Invoices */}
                  {clientInvs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/35 uppercase tracking-wide mb-2">
                        Invoices ({clientInvs.length})
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {clientInvs.map((inv) => (
                          <button
                            key={inv.id}
                            onClick={() => {
                              setViewClientId(null);
                              setViewInvoiceId(inv.id);
                            }}
                            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 hover:bg-white/[0.08] hover:border-white/20 transition text-left"
                          >
                            <span className="text-sm text-white/80">{inv.number}</span>
                            <span className="text-xs text-white/40">{inv.date}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
