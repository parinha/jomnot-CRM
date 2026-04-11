'use client';

import { useState, useRef } from 'react';
import {
  useStore,
  type Project,
  type ProjectItem,
  type ProjectItemStatus,
  type ProjectPhases,
  type ProjectStatus,
  type Client,
} from '../AppStore';
import { PROJECT_STATUS_CONFIG } from '@/app/_config/statusConfig';

// ── Phases config ─────────────────────────────────────────────────────────────
const PHASES: { key: keyof ProjectPhases; label: string }[] = [
  { key: 'filming', label: 'Filming' },
  { key: 'roughCut', label: 'Rough Cut' },
  { key: 'draft', label: 'Draft/VO' },
  { key: 'master', label: 'Master' },
  { key: 'delivered', label: 'Delivered' },
];
const DEFAULT_PHASES: ProjectPhases = {
  filming: false,
  roughCut: false,
  draft: false,
  master: false,
  delivered: false,
};
function phasesDone(phases?: ProjectPhases): number {
  if (!phases) return 0;
  return PHASES.filter((p) => phases[p.key]).length;
}
import { uid } from '@/app/_lib/id';
import { PAGE_SIZE } from '@/app/_config/constants';
import { calcNet } from '@/app/_services/invoiceService';
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
    phases: { ...DEFAULT_PHASES },
    status: 'draft',
    filmingDate: '',
    deliverDate: '',
    budget: undefined,
    note: '',
  };
}

// ── Timeline helper ────────────────────────────────────────────────────────────
// Badge + bar both count purely from today ↔ deliverDate.
// Bar always shows when deliverDate exists, using a 28-day virtual window
// (deliver - 28d → deliver). Overdue counts from deliverDate → today.
type TimelineBar = {
  daysLeft: number; // positive = remaining, negative = overdue
  isOverdue: boolean;
  badgeLabel: string;
  badgeCls: string;
  bar: { pct: number; barCls: string };
};

const TIMELINE_WINDOW = 28; // days

function getTimelineBar(deliverDate?: string): TimelineBar | null {
  if (!deliverDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliver = new Date(deliverDate);
  deliver.setHours(0, 0, 0, 0);

  const daysLeft = Math.round((deliver.getTime() - today.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  // Badge: how many days until deliver, or how many days late
  const badgeLabel = isOverdue
    ? `${Math.abs(daysLeft)}d Late`
    : daysLeft === 0
      ? 'Due Today'
      : `Due in ${daysLeft}d`;

  const badgeCls =
    isOverdue || daysLeft === 0
      ? 'bg-red-500/20 text-red-400'
      : daysLeft <= 3
        ? 'bg-orange-500/20 text-orange-400'
        : daysLeft <= 10
          ? 'bg-yellow-500/20 text-yellow-300'
          : 'bg-emerald-500/20 text-emerald-300';

  // Bar: progress through a 28-day window ending at deliverDate.
  // When overdue: counts forward from deliverDate → today (same 28-day window).
  let pct: number;
  if (isOverdue) {
    // How far past the deadline we are, out of TIMELINE_WINDOW days
    pct = Math.min(100, Math.round((Math.abs(daysLeft) / TIMELINE_WINDOW) * 100));
  } else {
    // How far through the final TIMELINE_WINDOW days we are
    pct = Math.min(
      100,
      Math.max(0, Math.round(((TIMELINE_WINDOW - daysLeft) / TIMELINE_WINDOW) * 100))
    );
  }

  const barCls =
    isOverdue || daysLeft === 0
      ? 'bg-red-500'
      : pct >= 90
        ? 'bg-orange-500'
        : pct >= 50
          ? 'bg-yellow-400'
          : 'bg-emerald-500';

  return { daysLeft, isOverdue, badgeLabel, badgeCls, bar: { pct, barCls } };
}

const inputCls =
  'h-11 rounded-xl border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full bg-white';
const darkInputCls =
  'h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full';

const EMPTY_CLIENT_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };
const FALLBACK_STATUS_CFG = { label: 'Unknown', cls: 'bg-zinc-700 text-zinc-300' };
function getStatusCfg(status: string) {
  return PROJECT_STATUS_CONFIG[status as ProjectStatus] ?? FALLBACK_STATUS_CFG;
}

// Simplified status options shown in the form (hides legacy 'confirmed' — maps to in-progress)
const FORM_STATUS_OPTIONS: { value: ProjectStatus; label: string; cls: string }[] = [
  { value: 'draft', label: 'Quoted', cls: 'bg-zinc-700 text-zinc-300' },
  { value: 'in-progress', label: 'Active', cls: 'bg-sky-500/20 text-sky-300' },
  { value: 'on-hold', label: 'On Hold', cls: 'bg-amber-500/20 text-amber-300' },
  { value: 'completed', label: 'Done', cls: 'bg-emerald-500/20 text-emerald-300' },
];

export default function ProjectsView() {
  const { clients, setClients, invoices, projects, setProjects, scopeOfWork, paymentInfo } =
    useStore();

  const [search, setSearch] = useState('');
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
  const [sortCol, setSortCol] = useState('timeline');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<'active' | 'on-hold' | 'quoted' | 'done'>('active');

  // ── Date range filter (for widgets) ──────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });

  function selectThisMonth() {
    const d = new Date();
    setDateFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    setDateTo(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10));
  }
  function selectLastMonth() {
    const d = new Date();
    const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const m = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
    setDateFrom(new Date(y, m, 1).toISOString().slice(0, 10));
    setDateTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
  }

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
      const statusLabel = PROJECT_STATUS_CONFIG[project.status]?.label ?? project.status;

      const deliverText = (() => {
        if (!project.deliverDate) return null;
        const d = new Date(project.deliverDate);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const month = d.toLocaleString('en-US', { month: 'long' });
        const dateStr = `${d.getFullYear()}/${month}/${d.getDate()}`;
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
        const relative =
          diff > 0
            ? `${diff} days to go`
            : diff === 0
              ? 'Due Today'
              : `${Math.abs(diff)} days late`;
        return `🚀 DELIVER DATE: ${dateStr} (${relative})`;
      })();

      const tl = getTimelineBar(project.deliverDate);
      const badgeEmoji = tl
        ? tl.isOverdue || tl.daysLeft === 0
          ? '🔴'
          : tl.badgeCls.includes('orange')
            ? '🟠'
            : tl.badgeCls.includes('yellow')
              ? '🟡'
              : '🟢'
        : null;
      const timelineText = tl ? `⏰ TIMELINE: ${badgeEmoji} ${tl.badgeLabel}` : null;

      const scopeLines = project.items.map((it, i) => {
        const prefix = i === 0 ? '┌' : i === project.items.length - 1 ? '└' : '├';
        const emoji = /photo|picture/i.test(it.description) ? '📸' : '🎥';
        return `${prefix} ${emoji} ${it.description}`;
      });

      const parts: string[] = [
        `📁 PROJECT: ${project.name}`,
        `🏷️ STATUS: ${statusLabel}`,
        ...(deliverText ? [deliverText] : []),
        ...(timelineText ? [timelineText] : []),
        ...(project.items.length > 0 ? ['📋 SCOPE OF WORK', ...scopeLines] : []),
      ];
      const text = parts.join('\n\n');

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
    if (activeTab === 'quoted' && p.status !== 'draft') return false;
    if (activeTab === 'on-hold' && p.status !== 'on-hold') return false;
    if (activeTab === 'done' && p.status !== 'completed') return false;
    if (activeTab === 'active' && p.status !== 'confirmed' && p.status !== 'in-progress')
      return false;
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
      phases: { ...DEFAULT_PHASES, ...project.phases },
      status: project.status,
      filmingDate: project.filmingDate ?? '',
      deliverDate: project.deliverDate ?? '',
      budget: project.budget,
      note: project.note ?? '',
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
  function saveProject(): Project | null {
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return null;
    }
    if (!form.clientId) {
      setFormError('Please select a client.');
      return null;
    }
    if (!form.deliverDate?.trim()) {
      setFormError('Deliver date is required.');
      return null;
    }
    if (form.status === 'completed' && phasesDone(form.phases) < 5) {
      setFormError('All 5 phases must be completed before marking the project as Done.');
      return null;
    }
    const cleanedForm = {
      ...form,
      filmingDate: form.filmingDate?.trim() || undefined,
      deliverDate: form.deliverDate?.trim() || undefined,
      budget: form.budget && form.budget > 0 ? form.budget : undefined,
      note: form.note?.trim() || undefined,
    };
    if (editingId) {
      const existing = projects.find((p) => p.id === editingId)!;
      // Set completedAt when newly marked completed; clear it when status changes away
      let completedAt = existing.completedAt;
      if (cleanedForm.status === 'completed' && existing.status !== 'completed') {
        completedAt = new Date().toISOString();
      } else if (cleanedForm.status !== 'completed') {
        completedAt = undefined;
      }
      const updated = { ...existing, ...cleanedForm, completedAt };
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

  function openDuplicate(project: Project) {
    setEditingId(null);
    setForm({
      name: `${project.name} (Copy)`,
      clientId: project.clientId,
      invoiceIds: [...project.invoiceIds],
      items: project.items.map((it) => ({ ...it })),
      phases: { ...DEFAULT_PHASES, ...project.phases },
      status: project.status,
      filmingDate: project.filmingDate ?? '',
      deliverDate: project.deliverDate ?? '',
      budget: project.budget,
      note: project.note ?? '',
    });
    setNewItemText('');
    setFormError('');
    resetClientCombo();
    setModalOpen(true);
  }

  function toggleDetailPhase(projectId: string, phaseKey: keyof ProjectPhases) {
    setProjects(
      projects.map((p) => {
        if (p.id !== projectId) return p;
        const current = { ...DEFAULT_PHASES, ...p.phases };
        return { ...p, phases: { ...current, [phaseKey]: !current[phaseKey] } };
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

      {/* Date range filter + widgets */}
      {(() => {
        const fmtAmt = (n: number) =>
          n === 0 ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

        // Project value: net from linked invoices, fallback to budget
        const projValue = (p: Project) => {
          const invNet = p.invoiceIds
            .map((id) => invoices.find((i) => i.id === id))
            .filter(Boolean)
            .reduce((sum, inv) => sum + calcNet(inv!), 0);
          return invNet > 0 ? invNet : (p.budget ?? 0);
        };

        // Filter projects whose deliverDate falls in the selected range
        const rangeProjects = projects.filter(
          (p) => p.deliverDate && p.deliverDate >= dateFrom && p.deliverDate <= dateTo
        );

        const quotedProjects = rangeProjects.filter((p) => p.status === 'draft');
        const quotedTotal = quotedProjects.reduce((s, p) => s + projValue(p), 0);

        const waitingProjects = rangeProjects.filter(
          (p) => p.status === 'confirmed' || p.status === 'in-progress' || p.status === 'on-hold'
        );
        const waitingTotal = waitingProjects.reduce((s, p) => s + projValue(p), 0);

        const completedProjects = rangeProjects.filter((p) => p.status === 'completed');
        const completedTotal = completedProjects.reduce((s, p) => s + projValue(p), 0);

        const pipelineTotal = waitingTotal + completedTotal;

        // Detect which quick-select is active
        const now = new Date();
        const thisMonthFrom = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10);
        const thisMonthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .slice(0, 10);
        const lmY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lmM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthFrom = new Date(lmY, lmM, 1).toISOString().slice(0, 10);
        const lastMonthTo = new Date(lmY, lmM + 1, 0).toISOString().slice(0, 10);
        const isThisMonth = dateFrom === thisMonthFrom && dateTo === thisMonthTo;
        const isLastMonth = dateFrom === lastMonthFrom && dateTo === lastMonthTo;

        const widgets = [
          {
            label: 'Quoted',
            value: fmtAmt(quotedTotal),
            sub: `${quotedProjects.length} project${quotedProjects.length !== 1 ? 's' : ''}`,
            color: 'text-white/70',
          },
          {
            label: 'In Progress',
            value: fmtAmt(waitingTotal),
            sub: `${waitingProjects.length} project${waitingProjects.length !== 1 ? 's' : ''}`,
            color: 'text-sky-400',
          },
          {
            label: 'Completed',
            value: fmtAmt(completedTotal),
            sub: `${completedProjects.length} project${completedProjects.length !== 1 ? 's' : ''}`,
            color: 'text-emerald-400',
          },
          {
            label: 'Total Pipeline',
            value: fmtAmt(pipelineTotal),
            sub: 'in progress + completed',
            color: 'text-[#FFC206]',
          },
        ];

        const quickBtnCls = (active: boolean) =>
          `h-8 px-3 rounded-lg text-xs font-semibold transition ${
            active
              ? 'bg-[#FFC206]/20 text-[#FFC206] border border-[#FFC206]/30'
              : 'bg-white/[0.06] text-white/50 border border-white/10 hover:text-white/80 hover:bg-white/10'
          }`;

        const dateCls =
          'h-8 rounded-lg border border-white/15 bg-white/[0.07] px-2 text-xs text-white/70 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition';

        return (
          <div className="mb-5">
            {/* Controls row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button className={quickBtnCls(isThisMonth)} onClick={selectThisMonth}>
                This Month
              </button>
              <button className={quickBtnCls(isLastMonth)} onClick={selectLastMonth}>
                Last Month
              </button>
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={dateCls}
                />
                <span className="text-white/30 text-xs">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={dateCls}
                />
              </div>
            </div>

            {/* Widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {widgets.map((w) => (
                <div
                  key={w.label}
                  className="rounded-2xl border border-white/[0.09] bg-white/[0.05] backdrop-blur-xl p-4"
                >
                  <p className={`text-xl font-bold ${w.color}`}>
                    <span className="amt">{w.value}</span>
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">{w.sub}</p>
                  <p className="text-xs text-white/55 mt-1">{w.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/[0.08]">
        {[
          {
            key: 'active' as const,
            label: 'Active',
            count: projects.filter((p) => p.status === 'confirmed' || p.status === 'in-progress')
              .length,
          },
          {
            key: 'on-hold' as const,
            label: 'On Hold',
            count: projects.filter((p) => p.status === 'on-hold').length,
          },
          {
            key: 'quoted' as const,
            label: 'Quoted',
            count: projects.filter((p) => p.status === 'draft').length,
          },
          {
            key: 'done' as const,
            label: 'Done',
            count: projects.filter((p) => p.status === 'completed').length,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${activeTab === tab.key ? 'border-[#FFC206] text-[#FFC206]' : 'border-transparent text-white/45 hover:text-white/70'}`}
          >
            {tab.label}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-[#FFC206]/20 text-[#FFC206]' : 'bg-white/10 text-white/40'}`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, client, invoice…"
        />
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
          <p className="text-sm">
            {activeTab === 'quoted'
              ? 'No quoted projects.'
              : activeTab === 'on-hold'
                ? 'No projects on hold.'
                : activeTab === 'done'
                  ? 'No completed projects.'
                  : 'No active projects match your filters.'}
          </p>
          {search.trim() && (
            <button
              onClick={() => setSearch('')}
              className="mt-2 text-xs text-[#FFC206] hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden flex flex-col gap-3">
            {paged.map((project) => {
              const client = clients.find((c) => c.id === project.clientId);
              const mobileDone = phasesDone(project.phases);
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
                            · <span className="amt">${project.budget.toLocaleString()}</span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
                        {sc.label}
                      </span>
                      {(() => {
                        const tl = getTimelineBar(project.deliverDate);
                        if (!tl) return null;
                        return (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tl.badgeCls}`}
                          >
                            {tl.badgeLabel}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                      <span>{mobileDone}/5 phases</span>
                      <span>{Math.round((mobileDone / 5) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${mobileDone === 5 ? 'bg-emerald-400' : mobileDone >= 3 ? 'bg-amber-400' : mobileDone > 0 ? 'bg-sky-400' : 'bg-white/20'}`}
                        style={{ width: `${Math.round((mobileDone / 5) * 100)}%` }}
                      />
                    </div>
                  </div>
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
                    Phases
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
                  const done = phasesDone(project.phases);
                  const sc = getStatusCfg(project.status);
                  return (
                    <tr
                      key={project.id}
                      className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 group">
                          <button
                            onClick={() => setDetailId(project.id)}
                            className="font-semibold text-white hover:text-[#FFC206] transition text-left"
                          >
                            {project.name}
                          </button>
                          <button
                            onClick={() => openDuplicate(project)}
                            title="Duplicate project"
                            className="opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-[#FFC206]"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
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
                        {(() => {
                          const cls =
                            done === 0
                              ? 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 hover:text-zinc-300'
                              : done < 3
                                ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 hover:text-sky-200'
                                : done < 5
                                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200'
                                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200';
                          return (
                            <button
                              onClick={() => setDetailId(project.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap ${cls}`}
                            >
                              <svg
                                className="w-3 h-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                />
                              </svg>
                              {done}/5
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {project.budget ? (
                          <span className="text-sm text-white/80 amt">
                            ${project.budget.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {(() => {
                          if (project.status === 'completed') {
                            return (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-500/20 text-emerald-300">
                                Delivered
                              </span>
                            );
                          }
                          const tl = getTimelineBar(project.deliverDate);
                          if (!tl) return <span className="text-white/25 text-xs">—</span>;
                          return (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${tl.badgeCls}`}
                            >
                              {tl.badgeLabel}
                            </span>
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
            {(detailProject.filmingDate || detailProject.deliverDate) &&
              (() => {
                const tl =
                  detailProject.status === 'completed'
                    ? null
                    : getTimelineBar(detailProject.deliverDate);
                return (
                  <div className="px-6 py-4 border-b border-white/[0.08] shrink-0 flex flex-col gap-3">
                    {/* Dates + badge row */}
                    <div className="flex items-center gap-4">
                      {detailProject.filmingDate && (
                        <div>
                          <p className="text-[10px] text-white/35 uppercase tracking-wide">
                            Filming
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {detailProject.filmingDate}
                          </p>
                        </div>
                      )}
                      {detailProject.deliverDate && (
                        <div>
                          <p className="text-[10px] text-white/35 uppercase tracking-wide">
                            Deliver
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {detailProject.deliverDate}
                          </p>
                        </div>
                      )}
                      {detailProject.status === 'completed' ? (
                        <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
                          Delivered
                        </span>
                      ) : tl ? (
                        <span
                          className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold ${tl.badgeCls}`}
                        >
                          {tl.badgeLabel}
                        </span>
                      ) : null}
                    </div>
                    {/* Progress bar */}
                    {tl && (
                      <div>
                        <div className="flex justify-between text-[10px] text-white/35 mb-1.5">
                          <span>{detailProject.filmingDate}</span>
                          <span
                            className="font-bold"
                            style={{
                              color: tl.isOverdue
                                ? '#ef4444'
                                : tl.bar.pct >= 90
                                  ? '#f97316'
                                  : tl.bar.pct >= 50
                                    ? '#facc15'
                                    : '#34d399',
                            }}
                          >
                            {tl.badgeLabel}
                          </span>
                          <span>{detailProject.deliverDate}</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${tl.bar.barCls}`}
                            style={{ width: `${tl.bar.pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-white/20 mt-1">
                          <span>Filming</span>
                          <span>{tl.bar.pct}% elapsed</span>
                          <span>Deliver</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Phase checklist */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                    Phases
                  </p>
                  <p className="text-xs text-white/40">{phasesDone(detailProject.phases)}/5 done</p>
                </div>
                <div className="flex flex-col gap-2">
                  {PHASES.map((phase) => {
                    const checked = detailProject.phases?.[phase.key] ?? false;
                    return (
                      <button
                        key={phase.key}
                        onClick={() => toggleDetailPhase(detailProject.id, phase.key)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left ${
                          checked
                            ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                            : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${checked ? 'border-emerald-400 bg-emerald-400' : 'border-white/25'}`}
                        >
                          {checked && (
                            <svg
                              className="w-3 h-3 text-zinc-900"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        <span
                          className={`text-sm font-medium ${checked ? 'line-through text-white/30' : 'text-white/80'}`}
                        >
                          {phase.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Deliverables list */}
              {detailProject.items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
                    Deliverables
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {detailProject.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03]"
                      >
                        <span className="w-1 h-1 rounded-full bg-white/30 mt-2 shrink-0" />
                        <span className="text-sm text-white/65">{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Mark as Done footer */}
            {detailProject.status !== 'completed' && (
              <div className="px-6 py-4 border-t border-white/[0.08] shrink-0">
                {(() => {
                  const allDone = phasesDone(detailProject.phases) === 5;
                  return (
                    <button
                      disabled={!allDone}
                      onClick={() => {
                        setProjects(
                          projects.map((p) =>
                            p.id === detailProject.id
                              ? { ...p, status: 'completed', completedAt: new Date().toISOString() }
                              : p
                          )
                        );
                        setDetailId(null);
                      }}
                      className={`w-full h-11 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                        allDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-white/[0.04] text-white/25 border border-white/[0.06] cursor-not-allowed'
                      }`}
                    >
                      {allDone ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Mark Project as Done
                        </>
                      ) : (
                        `Complete all phases first (${phasesDone(detailProject.phases)}/5)`
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
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
                  {FORM_STATUS_OPTIONS.map((opt) => {
                    // treat confirmed as equivalent to in-progress in the form
                    const isActive =
                      form.status === opt.value ||
                      (opt.value === 'in-progress' && form.status === 'confirmed');
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                        className={`h-9 px-4 rounded-xl text-xs font-semibold border transition ${isActive ? `${opt.cls} border-current` : 'border-white/20 text-white/50 hover:bg-white/10'}`}
                      >
                        {opt.label}
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
              {/* Phases */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Phases
                </label>
                <div className="flex flex-col gap-2">
                  {PHASES.map((phase) => {
                    const checked = form.phases?.[phase.key] ?? false;
                    return (
                      <button
                        key={phase.key}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            phases: { ...DEFAULT_PHASES, ...p.phases, [phase.key]: !checked },
                          }))
                        }
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition text-left ${
                          checked
                            ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                            : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${checked ? 'border-emerald-400 bg-emerald-400' : 'border-white/25'}`}
                        >
                          {checked && (
                            <svg
                              className="w-3 h-3 text-zinc-900"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        <span
                          className={`text-sm font-medium ${checked ? 'line-through text-white/30' : 'text-white/75'}`}
                        >
                          {phase.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Deliverables */}
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
                        Deliverables
                      </label>
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
                        {form.items.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 px-3 py-2.5 ${idx !== form.items.length - 1 ? 'border-b border-white/[0.06]' : ''} hover:bg-white/[0.04] transition`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white/25 shrink-0" />
                            <span className="text-sm flex-1 min-w-0 text-white/80">
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
                        ))}
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
                        placeholder="Add deliverable… (Enter)"
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

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Note <span className="normal-case font-normal text-white/30">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.note ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Any internal notes about this project…"
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full resize-none"
                />
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
