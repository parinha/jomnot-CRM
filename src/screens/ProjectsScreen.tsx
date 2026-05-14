'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import ProgressPopover from '@/src/components/ProgressPopover';
import ModalShell from '@/src/components/ModalShell';
import { useAppPreferences } from '@/src/hooks/useAppPreferences';
import type {
  Project,
  ProjectItem,
  ProjectItemStatus,
  ProjectStatus,
  Client,
  Invoice,
  PaymentInfo,
} from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { usePaymentInfo, useScopeOfWork } from '@/src/hooks/useSettings';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import { fmtDate } from '@/src/lib/formatters';
import { uid } from '@/src/lib/id';
import { calcNet } from '@/src/lib/calculations';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import SortTh from '@/src/components/SortTh';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';
import InvoicePreviewModal from '@/src/components/InvoicePreviewModal';
import ProjectDetailModal from '@/src/components/ProjectDetailModal';
import { useProjectMutations } from '@/src/hooks/useProjects';
import { useClientMutations } from '@/src/hooks/useClients';

type ProjectFormState = Omit<Project, 'id' | 'createdAt'>;
function blankForm(): ProjectFormState {
  return {
    name: '',
    clientId: '',
    invoiceIds: [],
    items: [],
    status: 'confirmed',
    confirmedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
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

/** Returns today as a local "YYYY-MM-DD" string (no UTC offset shift). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Normalises any date value to a local "YYYY-MM-DD" string.
 * - Pure date strings ("2026-04-30") are returned as-is.
 * - ISO timestamps ("2026-03-31T17:00:00.000Z") are parsed and converted to
 *   local calendar date, fixing the UTC-offset shift from old completedAt values.
 */
function toLocalDateStr(s: string | undefined): string {
  if (!s) return '';
  if (s.length === 10) return s; // already a date-only string
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_CLIENT_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };

function formatKhmerLocal(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
}
function phoneToLocal(full: string): string {
  return full.replace(/^\+855\s*/, '');
}
function phoneToFull(local: string): string {
  return local.trim() ? `+855 ${local}` : '';
}
const FALLBACK_STATUS_CFG = { label: 'Unknown', cls: 'bg-zinc-700 text-zinc-300' };
function getStatusCfg(status: string) {
  return PROJECT_STATUS_CONFIG[status as ProjectStatus] ?? FALLBACK_STATUS_CFG;
}

const FORM_STATUS_OPTIONS: { value: ProjectStatus; label: string; cls: string }[] = [
  { value: 'unconfirmed', label: 'Unconfirmed', cls: 'bg-zinc-700 text-zinc-300' },
  { value: 'confirmed', label: 'Confirmed', cls: 'bg-sky-500/20 text-sky-300' },
  { value: 'on-hold', label: 'On Hold', cls: 'bg-amber-500/20 text-amber-300' },
  { value: 'completed', label: 'Done', cls: 'bg-emerald-500/20 text-emerald-300' },
];

export default function ProjectsScreen() {
  const { data: clients, isLoading } = useClients();
  const { data: invoices } = useInvoices();
  const { data: projects } = useProjects();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: paymentInfo } = usePaymentInfo();
  const prefs = useAppPreferences();

  const [, startTransition] = useTransition();
  const { upsert: upsertProject, remove: deleteProject } = useProjectMutations();
  const { upsert: upsertClient } = useClientMutations();

  const searchParams = useSearchParams();
  const router = useRouter();

  const autoOpen = searchParams.get('new') === '1';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(autoOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(blankForm());
  const [confirmMonth, setConfirmMonth] = useState(() => blankForm().confirmedMonth ?? '');
  const [billingOpen, setBillingOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewClientId, setViewClientId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('timeline');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [completedTab, setCompletedTab] = useState<'this-month' | 'last-month'>('this-month');
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [holdUnconfPage, setHoldUnconfPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [unsetPage, setUnsetPage] = useState(1);
  const [progressPopover, setProgressPopover] = useState<string | null>(null);

  function openPopover(e: React.MouseEvent, projectId: string) {
    e.stopPropagation();
    setProgressPopover((prev) => (prev === projectId ? null : projectId));
  }

  function toggleItemInline(project: Project, itemId: string) {
    const updated: Project = {
      ...project,
      items: project.items.map((it) =>
        it.id === itemId ? { ...it, status: it.status === 'done' ? 'todo' : 'done' } : it
      ),
    };
    startTransition(async () => {
      await upsertProject(updated);
    });
  }

  // Modal is rendered once at the top of the JSX return; these per-row calls are no-ops
  function renderProgressPopover(_proj: Project) {
    return null;
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

  // Strip ?new=1 from URL after using it for initial state — no setState here
  useEffect(() => {
    if (autoOpen) {
      router.replace('/projects');
    }
  }, [autoOpen, router]);

  if (isLoading) return <TablePageSkeleton />;

  async function sendProjectToTelegram(project: Project) {
    const token = paymentInfo?.telegramBotToken?.trim();
    const chatId = paymentInfo?.projectTelegramChatId?.trim();
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Project Chat ID in Settings first.');
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
      if (paymentInfo?.projectTelegramTopicId?.trim()) {
        formData.append('message_thread_id', paymentInfo.projectTelegramTopicId.trim());
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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

  // ── Date boundaries ────────────────────────────────────────────────────────
  // Use local date formatting (not toISOString) to avoid UTC offset shifting dates
  const _pad = (n: number) => String(n).padStart(2, '0');
  const _localDate = (d: Date) =>
    `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
  const _now = new Date();
  const pmY = _now.getMonth() === 0 ? _now.getFullYear() - 1 : _now.getFullYear();
  const pmM = _now.getMonth() === 0 ? 11 : _now.getMonth() - 1;
  const nmY = _now.getMonth() === 11 ? _now.getFullYear() + 1 : _now.getFullYear();
  const nmM = _now.getMonth() === 11 ? 0 : _now.getMonth() + 1;
  const nextMonthLabel = new Date(nmY, nmM, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // ── Global search match ────────────────────────────────────────────────────
  function matchesSearch(p: Project): boolean {
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
  }

  // ── Section data ───────────────────────────────────────────────────────────
  const cmYM = `${_now.getFullYear()}-${_pad(_now.getMonth() + 1)}`; // e.g. "2026-04"
  const nmYM = `${nmY}-${_pad(nmM + 1)}`;

  // Active: all confirmed projects (this month + older)
  const activeBase = projects.filter(
    (p) => p.status === 'confirmed' && p.confirmedMonth !== nmYM && matchesSearch(p)
  );
  const activeThisMonth = activeBase.filter((p) => p.confirmedMonth === cmYM);
  const activeOld = activeBase.filter((p) => p.confirmedMonth !== cmYM);

  const activeSorted = [...activeBase].sort((a, b) => {
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
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const ACTIVE_PAGE_SIZE = 15;
  const activeTotalPages = Math.max(1, Math.ceil(activeSorted.length / ACTIVE_PAGE_SIZE));
  const safeActivePage = Math.min(page, activeTotalPages);
  const activePaged = activeSorted.slice(
    (safeActivePage - 1) * ACTIVE_PAGE_SIZE,
    safeActivePage * ACTIVE_PAGE_SIZE
  );

  // On Hold
  const onHoldList = projects.filter((p) => p.status === 'on-hold' && matchesSearch(p));

  // Unconfirmed
  const unconfirmedList = projects
    .filter((p) => p.status === 'unconfirmed' && matchesSearch(p))
    .sort((a, b) => (a.deliverDate ?? '').localeCompare(b.deliverDate ?? ''));

  // Upcoming: confirmedMonth = next month, any non-completed status
  const upcomingList = projects
    .filter((p) => p.status !== 'completed' && p.confirmedMonth === nmYM && matchesSearch(p))
    .sort((a, b) => (a.deliverDate ?? '').localeCompare(b.deliverDate ?? ''));

  // Side panel pagination (3 rows, fixed height)
  const SIDE_PAGE_SIZE = 3;
  const upcomingTotalPages = Math.max(1, Math.ceil(upcomingList.length / SIDE_PAGE_SIZE));
  const safeUpcomingPage = Math.min(upcomingPage, upcomingTotalPages);
  const upcomingPaged = upcomingList.slice(
    (safeUpcomingPage - 1) * SIDE_PAGE_SIZE,
    safeUpcomingPage * SIDE_PAGE_SIZE
  );
  const holdUnconfCombined = [...unconfirmedList, ...onHoldList].sort((a, b) =>
    (a.deliverDate ?? '').localeCompare(b.deliverDate ?? '')
  );
  const holdUnconfTotalPages = Math.max(1, Math.ceil(holdUnconfCombined.length / SIDE_PAGE_SIZE));
  const safeHoldUnconfPage = Math.min(holdUnconfPage, holdUnconfTotalPages);
  const holdUnconfPaged = holdUnconfCombined.slice(
    (safeHoldUnconfPage - 1) * SIDE_PAGE_SIZE,
    safeHoldUnconfPage * SIDE_PAGE_SIZE
  );
  // Row height constant (px): py-3 rows = 12px*2 padding + ~20px content
  const SIDE_ROW_H = 52;

  // Section budget totals
  const fmtBudget = (list: typeof projects) => {
    const total = list.reduce((s, p) => s + (p.budget ?? 0), 0);
    return total > 0 ? `$${total.toLocaleString()}` : null;
  };
  const upcomingBudget = fmtBudget(upcomingList);
  const holdUnconfBudget = fmtBudget(holdUnconfCombined);
  const activeBudget = fmtBudget(activeBase);
  const activeThisMonthBudget = fmtBudget(activeThisMonth);
  const activeOldBudget = fmtBudget(activeOld);

  const pmYM = `${pmY}-${_pad(pmM + 1)}`;

  // Completed: filtered by confirmedMonth
  const completedList = projects
    .filter((p) => {
      if (p.status !== 'completed') return false;
      if (!matchesSearch(p)) return false;
      if (completedTab === 'this-month') return p.confirmedMonth === cmYM;
      return p.confirmedMonth === pmYM;
    })
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const completedTotalPages = Math.max(1, Math.ceil(completedList.length / SIDE_PAGE_SIZE));
  const safeCompletedPage = Math.min(completedPage, completedTotalPages);
  const completedPaged = completedList.slice(
    (safeCompletedPage - 1) * SIDE_PAGE_SIZE,
    safeCompletedPage * SIDE_PAGE_SIZE
  );
  const completedBudget = fmtBudget(completedList);

  // Unset confirm month: any project (any status) without confirmedMonth
  const unsetConfirmedList = projects
    .filter((p) => !p.confirmedMonth && matchesSearch(p))
    .sort((a, b) => a.name.localeCompare(b.name));
  const unsetTotalPages = Math.max(1, Math.ceil(unsetConfirmedList.length / SIDE_PAGE_SIZE));
  const safeUnsetPage = Math.min(unsetPage, unsetTotalPages);
  const unsetPaged = unsetConfirmedList.slice(
    (safeUnsetPage - 1) * SIDE_PAGE_SIZE,
    safeUnsetPage * SIDE_PAGE_SIZE
  );

  function resetClientCombo() {
    setClientSearch('');
    setClientDropOpen(false);
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
  }

  function openAdd() {
    setEditingId(null);
    const blank = blankForm();
    setForm(blank);
    setConfirmMonth(blank.confirmedMonth ?? '');
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
      confirmedMonth: project.confirmedMonth ?? '',
      filmingDate: project.filmingDate ?? '',
      deliverDate: project.deliverDate ?? '',
      budget: project.budget,
      note: project.note ?? '',
    });
    setConfirmMonth(project.confirmedMonth ?? '');
    setNewItemText('');
    setFormError('');
    resetClientCombo();
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(blankForm());
    setConfirmMonth('');
    setBillingOpen(false);
    setNewItemText('');
    setFormError('');
    resetClientCombo();
  }

  function applyConfirmMonth(val: string) {
    setConfirmMonth(val);
    setForm((p) => ({ ...p, confirmedMonth: val || undefined }));
  }

  function saveNewClient() {
    if (!clientForm.name.trim()) {
      setClientFormError('Name is required.');
      return;
    }
    const newClient: Client = { id: uid(), ...clientForm };
    handleClientChange(newClient.id);
    setShowClientForm(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setClientFormError('');
    startTransition(async () => {
      await upsertClient(newClient);
    });
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
  function handleSave() {
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    if (!form.clientId) {
      setFormError('Please select a client.');
      return;
    }
    const cleanedForm = {
      ...form,
      confirmedMonth: form.confirmedMonth?.trim() || undefined,
      filmingDate: form.filmingDate?.trim() || undefined,
      deliverDate: form.deliverDate?.trim() || undefined,
      budget: form.budget && form.budget > 0 ? form.budget : undefined,
      note: form.note?.trim() || undefined,
    };
    let project: Project;
    if (editingId) {
      const existing = projects.find((p) => p.id === editingId)!;
      let completedAt = existing.completedAt;
      if (cleanedForm.status === 'completed' && existing.status !== 'completed') {
        completedAt = localToday();
      } else if (cleanedForm.status !== 'completed') {
        completedAt = undefined;
      }
      project = { ...existing, ...cleanedForm, completedAt };
    } else {
      project = { id: uid(), createdAt: localToday(), ...cleanedForm };
    }
    closeModal();
    startTransition(async () => {
      await upsertProject(project);
    });
  }

  function handleDelete(id: string) {
    setDeleteId(null);
    startTransition(async () => {
      await deleteProject(id);
    });
  }

  function openDuplicate(project: Project) {
    setEditingId(null);
    setForm({
      name: `${project.name} (Copy)`,
      clientId: project.clientId,
      invoiceIds: [...project.invoiceIds],
      items: project.items.map((it) => ({ ...it })),
      status: project.status,
      confirmedMonth: project.confirmedMonth ?? blankForm().confirmedMonth,
      kanbanPhase: project.kanbanPhase,
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

  const clientInvoices = form.clientId ? invoices.filter((i) => i.clientId === form.clientId) : [];

  const popoverProject = progressPopover ? projects.find((p) => p.id === progressPopover) : null;

  return (
    <>
      {popoverProject && (
        <ProgressPopover
          project={popoverProject}
          onClose={() => setProgressPopover(null)}
          onToggleItem={(itemId) => toggleItemInline(popoverProject, itemId)}
        />
      )}

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

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
      </div>

      {/* Unified project list */}
      {(() => {
        const filtered = projects.filter(matchesSearch).sort((a, b) => {
          if (!a.createdAt && !b.createdAt) return 0;
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return b.createdAt.localeCompare(a.createdAt);
        });
        if (filtered.length === 0) {
          return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl flex flex-col items-center justify-center py-16">
              <p className="text-sm text-white/30">
                {search.trim() ? 'No projects match your search.' : 'No projects yet.'}
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
          );
        }
        return (
          <div className="flex flex-col gap-3">
            {filtered.map((project) => {
              const client = clients.find((c) => c.id === project.clientId);
              const sc = PROJECT_STATUS_CONFIG[project.status];
              return (
                <div
                  key={project.id}
                  className="bg-white/[0.05] border border-white/[0.09] rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                        >
                          {sc.label}
                        </span>
                        <span className="text-sm font-semibold text-white truncate">
                          {project.name}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 truncate">
                        {client?.name ?? 'No client'}
                      </p>
                      {project.items.length > 0 && (
                        <div className="mt-2.5">
                          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">
                            SOW
                          </p>
                          <div className="flex flex-col gap-0.5">
                            {project.items.map((item) => (
                              <p key={item.id} className="text-xs text-white/50">
                                · {item.description}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openEdit(project)}
                      className="shrink-0 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
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
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Detail modal */}
      {detailId && <ProjectDetailModal projectId={detailId} onClose={() => setDetailId(null)} />}

      {/* Add / Edit modal */}
      {modalOpen && (
        <ModalShell onClose={closeModal} maxWidth="max-w-xl">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.08] shrink-0">
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
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
            {/* Client */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Client
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="flex h-11 rounded-xl border border-white/20 bg-white/10 focus-within:ring-2 focus-within:ring-[#FFC206] focus-within:border-transparent transition overflow-hidden">
                        <span className="flex items-center px-3 text-sm font-medium text-white/50 bg-white/5 border-r border-white/20 shrink-0 select-none">
                          +855
                        </span>
                        <input
                          type="tel"
                          value={phoneToLocal(clientForm.phone)}
                          onChange={(e) => {
                            const formatted = formatKhmerLocal(e.target.value);
                            setClientForm((p) => ({ ...p, phone: phoneToFull(formatted) }));
                          }}
                          placeholder="12 123 1234"
                          className="flex-1 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none bg-transparent"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-xs text-white/50">Address</label>
                      <input
                        value={clientForm.address}
                        onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))}
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
                  selectedClient ? `${selectedClient.name} — Project` : 'e.g. Wedding Video Package'
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
            {/* Status — edit only */}
            {editingId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Status
                </label>
                <div className="flex gap-2 flex-wrap">
                  {FORM_STATUS_OPTIONS.map((opt) => {
                    const isActive = form.status === opt.value;
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
            )}
            {/* Budget + Billing Month row */}
            {(() => {
              const now = new Date();
              const thisMonthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              const nextY = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
              const nextM = ((now.getMonth() + 1) % 12) + 1;
              const nextMonthVal = `${nextY}-${String(nextM).padStart(2, '0')}`;
              const displayMonth = confirmMonth
                ? new Date(confirmMonth + '-01').toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Not set';
              return (
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Budget */}
                  <div className="flex flex-col gap-1.5 flex-1">
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

                  {/* Billing Month */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                      Billing Month
                    </label>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => setBillingOpen((o) => !o)}
                        className="h-11 w-full flex items-center justify-between px-4 rounded-xl border border-white/20 bg-white/10 text-sm transition hover:bg-white/[0.15]"
                      >
                        <span className={confirmMonth ? 'text-white font-medium' : 'text-white/40'}>
                          {displayMonth}
                        </span>
                        <svg
                          className={`w-4 h-4 text-white/40 transition-transform ${billingOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {billingOpen && (
                        <div className="mt-1.5 flex flex-col gap-1.5 p-3 rounded-xl border border-white/[0.1] bg-white/[0.05]">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                applyConfirmMonth(thisMonthVal);
                                setBillingOpen(false);
                              }}
                              className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${confirmMonth === thisMonthVal ? 'border-amber-500/60 bg-amber-500/20 text-amber-400' : 'border-white/[0.1] bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white'}`}
                            >
                              This Month
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                applyConfirmMonth(nextMonthVal);
                                setBillingOpen(false);
                              }}
                              className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${confirmMonth === nextMonthVal ? 'border-amber-500/60 bg-amber-500/20 text-amber-400' : 'border-white/[0.1] bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white'}`}
                            >
                              Next Month
                            </button>
                          </div>
                          <input
                            type="month"
                            value={confirmMonth}
                            className={`${darkInputCls} [color-scheme:dark] text-xs h-9`}
                            onChange={(e) => {
                              applyConfirmMonth(e.target.value);
                              setBillingOpen(false);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dates */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Timeline
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="text-xs text-white/45">
                    Deliver Date <span className="text-white/25">(optional)</span>
                  </label>
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
                      <span className="text-xs text-white/40">{fmtDate(inv.date)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Deliverables */}
            <div className="relative">
              {!form.name.trim() && (
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
                  <p className="text-xs text-white/40 text-center px-4">
                    Enter a project name first
                  </p>
                </div>
              )}
              <div
                className={!form.name.trim() ? 'pointer-events-none select-none opacity-30' : ''}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                      Deliverables
                    </label>
                  </div>
                  {form.items.length === 0 && form.name.trim() && (
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
                          {editingId ? (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((p) => ({
                                  ...p,
                                  items: p.items.map((it) =>
                                    it.id === item.id
                                      ? { ...it, status: it.status === 'done' ? 'todo' : 'done' }
                                      : it
                                  ),
                                }))
                              }
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${item.status === 'done' ? 'bg-violet-500 border-violet-500' : 'border-white/30 hover:border-white/60'}`}
                            >
                              {item.status === 'done' && (
                                <svg
                                  className="w-2.5 h-2.5 text-white"
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
                            </button>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-white/25 shrink-0" />
                          )}
                          <span
                            className={`text-sm flex-1 min-w-0 transition ${editingId && item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}
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
          {formError && (
            <p className="px-4 sm:px-6 py-2 text-sm text-red-400 shrink-0">{formError}</p>
          )}
          <div className="flex flex-col gap-2 px-4 sm:px-6 py-4 border-t border-white/[0.08] shrink-0">
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
          </div>
        </ModalShell>
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
      {viewInvoiceId &&
        (() => {
          const inv = invoices.find((i) => i.id === viewInvoiceId) ?? null;
          const client = inv ? (clients.find((c) => c.id === inv.clientId) ?? null) : null;
          return (
            <InvoicePreviewModal inv={inv} client={client} onClose={() => setViewInvoiceId(null)} />
          );
        })()}

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
                            <span className="text-xs text-white/40">{fmtDate(inv.date)}</span>
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
