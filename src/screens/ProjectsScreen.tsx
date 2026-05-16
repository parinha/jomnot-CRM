'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ModalShell from '@/src/components/ModalShell';
import { useCurrency, useAppPreferences } from '@/src/hooks/useAppPreferences';
import type { Project, ProjectItem, ProjectItemStatus, ProjectStatus, Client } from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { useScopeOfWork } from '@/src/hooks/useSettings';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { PROJECT_STATUS_CONFIG, STATUS_CONFIG } from '@/src/config/statusConfig';
import { fmtDate } from '@/src/lib/formatters';
import { uid } from '@/src/lib/id';
import SearchInput from '@/src/components/SearchInput';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';
import InvoicePreviewModal from '@/src/components/InvoicePreviewModal';
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

const darkInputCls =
  'h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full';

/** Returns today as a local "YYYY-MM-DD" string (no UTC offset shift). */
function localToday(): string {
  const d = new Date();
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
  const { fmtAmount: fmt } = useCurrency();
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
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  // Client combobox
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  // Inline client create
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientFormError, setClientFormError] = useState('');

  // Strip ?new=1 from URL after using it for initial state — no setState here
  useEffect(() => {
    if (autoOpen) {
      router.replace('/projects');
    }
  }, [autoOpen, router]);

  if (isLoading) return <TablePageSkeleton />;

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

      {/* Phase filter tabs */}
      {(() => {
        const phases = prefs.kanbanPhases;
        const firstId = phases[0]?.id ?? '';
        const lastId = phases[phases.length - 1]?.id ?? '';
        const isKanbanDone = (p: Project) => (p.kanbanPhase ?? firstId) === lastId;
        const isStatusDone = (p: Project) => p.status === 'completed';
        const isActive = (p: Project) => !isKanbanDone(p) && !isStatusDone(p);

        const chipCls = (active: boolean) =>
          `flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-semibold transition ${active ? 'bg-[#FFC206] text-zinc-900' : 'bg-white/[0.07] text-white/50 hover:bg-white/[0.12] hover:text-white'}`;
        const badgeCls = (active: boolean) =>
          `text-xs font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-zinc-900/20 text-zinc-900' : 'bg-white/10 text-white/40'}`;

        return (
          <div className="flex flex-wrap gap-2 mb-4">
            {/* All — active only (excludes kanban-done and status-done) */}
            <button
              onClick={() => setPhaseFilter('all')}
              className={chipCls(phaseFilter === 'all')}
            >
              All
              <span className={badgeCls(phaseFilter === 'all')}>
                {projects.filter(isActive).length}
              </span>
            </button>

            {/* Phase chips — all phases except the last (done) phase, active projects only */}
            {phases.slice(0, -1).map((phase) => {
              const count = projects.filter(
                (p) => isActive(p) && (p.kanbanPhase ?? firstId) === phase.id
              ).length;
              const active = phaseFilter === phase.id;
              return (
                <button
                  key={phase.id}
                  onClick={() => setPhaseFilter(phase.id)}
                  className={chipCls(active)}
                >
                  {phase.label}
                  <span className={badgeCls(active)}>{count}</span>
                </button>
              );
            })}

            {/* Done — kanban in last phase, project status is NOT completed */}
            {(() => {
              const count = projects.filter((p) => isKanbanDone(p) && !isStatusDone(p)).length;
              const active = phaseFilter === 'done';
              return (
                <button onClick={() => setPhaseFilter('done')} className={chipCls(active)}>
                  Done
                  <span className={badgeCls(active)}>{count}</span>
                </button>
              );
            })()}

            {/* Completed — project status is completed (regardless of kanban phase) */}
            {(() => {
              const count = projects.filter(isStatusDone).length;
              const active = phaseFilter === 'completed';
              return (
                <button onClick={() => setPhaseFilter('completed')} className={chipCls(active)}>
                  Completed
                  <span className={badgeCls(active)}>{count}</span>
                </button>
              );
            })()}
          </div>
        );
      })()}

      {/* Search */}
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
      </div>

      {/* Unified project list */}
      {(() => {
        const phases = prefs.kanbanPhases;
        const firstPhaseId = phases[0]?.id ?? '';
        const lastPhaseId = phases[phases.length - 1]?.id ?? '';
        const isKanbanDone = (p: Project) => (p.kanbanPhase ?? firstPhaseId) === lastPhaseId;
        const isStatusDone = (p: Project) => p.status === 'completed';
        const isActive = (p: Project) => !isKanbanDone(p) && !isStatusDone(p);
        const filtered = projects
          .filter((p) => {
            if (!matchesSearch(p)) return false;
            if (phaseFilter === 'completed') return isStatusDone(p);
            if (phaseFilter === 'done') return isKanbanDone(p) && !isStatusDone(p);
            if (phaseFilter === 'all') return isActive(p);
            return isActive(p) && (p.kanbanPhase ?? firstPhaseId) === phaseFilter;
          })
          .sort((a, b) => {
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
                <button
                  key={project.id}
                  onClick={() => setViewProjectId(project.id)}
                  className="w-full text-left bg-white/[0.05] border border-white/[0.09] rounded-2xl p-4 active:bg-white/[0.08] transition"
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
                            Scope of Work
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
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(project);
                      }}
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
                    </span>
                  </div>
                  {/* Progress bar (All tab) or phase nav buttons (other tabs) */}
                  {(() => {
                    const currentPhaseId = project.kanbanPhase ?? firstPhaseId;
                    const currentIdx = phases.findIndex((ph) => ph.id === currentPhaseId);

                    if (phaseFilter === 'all') {
                      const pct =
                        phases.length > 1
                          ? Math.round((currentIdx / (phases.length - 1)) * 100)
                          : 0;
                      return (
                        <div className="mt-3 pt-3 border-t border-white/[0.07]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-white/40">
                              {phases[currentIdx]?.label ?? ''}
                            </span>
                            <span className="text-[10px] font-semibold text-white/40">{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#FFC206] transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }

                    const prevPhase = currentIdx > 0 ? phases[currentIdx - 1] : null;
                    const nextPhase =
                      currentIdx < phases.length - 1 ? phases[currentIdx + 1] : null;
                    if (!prevPhase && !nextPhase) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-white/[0.07] flex gap-2">
                        {prevPhase ? (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startTransition(async () => {
                                await upsertProject({ ...project, kanbanPhase: prevPhase.id });
                              });
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-white/50 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white active:bg-white/[0.18] transition"
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
                                d="M15 19l-7-7 7-7"
                              />
                            </svg>
                            {prevPhase.label}
                          </span>
                        ) : (
                          <span className="flex-1" />
                        )}
                        {nextPhase ? (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startTransition(async () => {
                                await upsertProject({ ...project, kanbanPhase: nextPhase.id });
                              });
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-white/50 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white active:bg-white/[0.18] transition"
                          >
                            {nextPhase.label}
                            <svg
                              className="w-3 h-3 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        ) : (
                          <span className="flex-1" />
                        )}
                      </div>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Project detail sheet */}
      {viewProjectId &&
        (() => {
          const project = projects.find((p) => p.id === viewProjectId);
          if (!project) return null;
          const client = clients.find((c) => c.id === project.clientId);
          const sc = PROJECT_STATUS_CONFIG[project.status];
          const linkedInvs = project.invoiceIds
            .map((id) => invoices.find((i) => i.id === id))
            .filter(Boolean) as typeof invoices;

          return (
            <ModalShell onClose={() => setViewProjectId(null)}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-white">{project.name}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{client?.name ?? '—'}</p>
                </div>
                <button
                  onClick={() => setViewProjectId(null)}
                  className="p-1.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition shrink-0"
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
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                {/* Meta */}
                {(project.filmingDate || project.deliverDate || project.budget) && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {project.filmingDate && (
                      <div>
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Filming</p>
                        <p className="text-white">{fmtDate(project.filmingDate)}</p>
                      </div>
                    )}
                    {project.deliverDate && (
                      <div>
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Deliver</p>
                        <p className="text-white">{fmtDate(project.deliverDate)}</p>
                      </div>
                    )}
                    {project.budget != null && (
                      <div>
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Budget</p>
                        <p className="text-white font-semibold">{fmt(project.budget)}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* SOW / deliverables */}
                {project.items.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                      Scope of Work
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {project.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'done' ? 'bg-violet-400' : 'bg-white/20'}`}
                          />
                          <span
                            className={`text-sm ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/75'}`}
                          >
                            {item.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked invoices */}
                <div>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Invoices
                  </p>
                  {linkedInvs.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {linkedInvs.map((inv) => {
                        const isc = STATUS_CONFIG[inv.status ?? 'draft'];
                        return (
                          <button
                            key={inv.id}
                            onClick={() => {
                              setViewProjectId(null);
                              setViewInvoiceId(inv.id);
                            }}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{inv.number}</p>
                              <p className="text-xs text-white/40">{inv.date}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isc.cls}`}
                            >
                              {isc.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 italic">
                      No invoices linked to this project
                    </p>
                  )}
                </div>

                {/* Status change */}
                <div>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Change Status
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((s) => {
                      const sconf = PROJECT_STATUS_CONFIG[s];
                      const isActive = project.status === s;
                      return (
                        <button
                          key={s}
                          disabled={isActive}
                          onClick={() => {
                            startTransition(async () => {
                              await upsertProject({ ...project, status: s });
                              setViewProjectId(null);
                            });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${isActive ? sconf.cls + ' ring-1 ring-white/20 cursor-default' : 'bg-white/[0.07] text-white/50 hover:bg-white/[0.13]'}`}
                        >
                          {sconf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/[0.08] shrink-0 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setViewProjectId(null);
                    openEdit(project);
                  }}
                  className="h-11 w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition"
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
                  Edit Project
                </button>
                <button
                  onClick={() => {
                    setViewProjectId(null);
                    setDeleteId(project.id);
                  }}
                  className="h-10 w-full flex items-center justify-center gap-2 rounded-xl border border-red-400/25 text-red-400/80 text-sm hover:bg-red-500/10 hover:text-red-400 transition"
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
                  Delete Project
                </button>
              </div>
            </ModalShell>
          );
        })()}

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
    </>
  );
}
