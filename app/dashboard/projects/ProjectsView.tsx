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
import ModalShell from '@/app/_components/ModalShell';

type ProjectFormState = Omit<Project, 'id' | 'createdAt'>;
function blankForm(): ProjectFormState {
  return { name: '', clientId: '', invoiceIds: [], items: [], status: 'active' };
}

const inputCls =
  'h-11 rounded-xl border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full bg-white';
const darkInputCls =
  'h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full';

const EMPTY_CLIENT_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };

export default function ProjectsView() {
  const { clients, setClients, invoices, projects, setProjects, scopeOfWork } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(blankForm());
  const [newItemText, setNewItemText] = useState('');
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Client combobox
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  // Inline client create
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientFormError, setClientFormError] = useState('');

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  function handleSave() {
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    if (!form.clientId) {
      setFormError('Please select a client.');
      return;
    }
    if (editingId) {
      setProjects(projects.map((p) => (p.id === editingId ? { ...p, ...form } : p)));
    } else {
      setProjects([...projects, { id: uid(), createdAt: new Date().toISOString(), ...form }]);
    }
    closeModal();
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

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((s) => {
          const count = projects.filter((p) => p.status === s).length;
          const cfg = PROJECT_STATUS_CONFIG[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(active ? 'all' : s);
                setPage(1);
              }}
              className={`rounded-2xl border p-4 text-left transition backdrop-blur-xl ${active ? 'bg-white/15 border-white/30' : 'bg-white/[0.05] border-white/[0.09] hover:bg-white/10'}`}
            >
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs mt-1 text-white/50">{cfg.label}</p>
            </button>
          );
        })}
      </div>

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
          {(['all', 'active', 'completed', 'on-hold'] as const).map((f) => (
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
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden overflow-x-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/35">
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
          <div className="flex flex-col items-center justify-center py-14 text-white/35">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                <th className="text-left px-4 py-3.5 font-medium text-white/45">Project</th>
                <th className="text-left px-4 py-3.5 font-medium text-white/45 hidden sm:table-cell">
                  Client
                </th>
                <th className="text-left px-4 py-3.5 font-medium text-white/45 hidden md:table-cell">
                  Invoice(s)
                </th>
                <th className="text-left px-4 py-3.5 font-medium text-white/45 hidden sm:table-cell">
                  Progress
                </th>
                <th className="text-left px-4 py-3.5 font-medium text-white/45">Status</th>
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
                const sc = PROJECT_STATUS_CONFIG[project.status];
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
                    <td className="px-4 py-3.5 text-white/60 hidden sm:table-cell">
                      {client?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {linkedInvoices.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {linkedInvoices.map(
                            (inv) =>
                              inv && (
                                <span
                                  key={inv.id}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/60"
                                >
                                  {inv.number}
                                </span>
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
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
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
        )}
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={filtered.length}
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
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PROJECT_STATUS_CONFIG[detailProject.status].cls}`}
                >
                  {PROJECT_STATUS_CONFIG[detailProject.status].label}
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
            <div className="flex gap-3 px-6 py-4 border-t border-white/[0.08] shrink-0">
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
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <ModalShell onClose={() => setDeleteId(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Delete project?</h2>
            <p className="text-sm text-zinc-500 mb-6">
              This will permanently delete the project and its scope items.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 h-11 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
