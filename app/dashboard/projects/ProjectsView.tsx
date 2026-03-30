'use client'

import { useState, useEffect } from 'react'
import { useStore, type Project, type ProjectItem, type ProjectItemStatus, type ProjectStatus } from '../AppStore'
import { PROJECT_STATUS_CONFIG, ITEM_STATUS_CONFIG, ITEM_STATUS_NEXT } from '@/app/_config/statusConfig'
import { uid } from '@/app/_lib/id'
import { PAGE_SIZE } from '@/app/_config/constants'
import SearchInput from '@/app/_components/SearchInput'
import Pagination from '@/app/_components/Pagination'
import ModalShell from '@/app/_components/ModalShell'

type ProjectFormState = Omit<Project, 'id' | 'createdAt'>

function blankForm(): ProjectFormState {
  return { name: '', clientId: '', invoiceIds: [], items: [], status: 'active' }
}

export default function ProjectsView() {
  const { clients, invoices, projects, setProjects, scopeOfWork } = useStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormState>(blankForm())
  const [newItemText, setNewItemText] = useState('')
  const [formError, setFormError] = useState('')

  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [page, setPage] = useState(1)

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const client = clients.find((c) => c.id === p.clientId)
    const invNums = p.invoiceIds.map((id) => invoices.find((i) => i.id === id)?.number ?? '').join(' ')
    return (
      p.name.toLowerCase().includes(q) ||
      (client?.name ?? '').toLowerCase().includes(q) ||
      invNums.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter])

  function openAdd() {
    setEditingId(null)
    setForm(blankForm())
    setNewItemText('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(project: Project) {
    setEditingId(project.id)
    setForm({
      name: project.name,
      clientId: project.clientId,
      invoiceIds: [...project.invoiceIds],
      items: project.items.map((it) => ({ ...it })),
      status: project.status,
    })
    setNewItemText('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(blankForm())
    setNewItemText('')
    setFormError('')
  }

  const selectedClient = clients.find((c) => c.id === form.clientId)

  function handleClientChange(clientId: string) {
    setForm((prev) => {
      // Pre-populate scope items from global list when client is first set and items are empty
      const items = prev.items.length === 0 && clientId
        ? scopeOfWork.map((desc) => ({ id: uid(), description: desc, status: 'todo' as ProjectItemStatus }))
        : prev.items
      // Clear invoice links that don't belong to new client
      const clientInvoiceIds = invoices.filter((i) => i.clientId === clientId).map((i) => i.id)
      const invoiceIds = prev.invoiceIds.filter((id) => clientInvoiceIds.includes(id))
      return { ...prev, clientId, items, invoiceIds }
    })
  }

  function toggleInvoice(invoiceId: string) {
    setForm((prev) => ({
      ...prev,
      invoiceIds: prev.invoiceIds.includes(invoiceId)
        ? prev.invoiceIds.filter((id) => id !== invoiceId)
        : [...prev.invoiceIds, invoiceId],
    }))
  }

  function addScopeItem() {
    const text = newItemText.trim()
    if (!text) return
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), description: text, status: 'todo' }],
    }))
    setNewItemText('')
  }

  function removeItem(itemId: string) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== itemId) }))
  }

  function cycleItemStatus(itemId: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, status: ITEM_STATUS_NEXT[it.status] } : it
      ),
    }))
  }

  function handleSave() {
    if (!form.name.trim()) { setFormError('Project name is required.'); return }
    if (!form.clientId) { setFormError('Please select a client.'); return }

    if (editingId) {
      setProjects(projects.map((p) => p.id === editingId ? { ...p, ...form } : p))
    } else {
      setProjects([...projects, { id: uid(), createdAt: new Date().toISOString(), ...form }])
    }
    closeModal()
  }

  function handleDelete(id: string) {
    setProjects(projects.filter((p) => p.id !== id))
    setDeleteId(null)
  }

  // Cycle scope item status directly on the detail view
  function cycleDetailItemStatus(projectId: string, itemId: string) {
    setProjects(projects.map((p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        items: p.items.map((it) =>
          it.id === itemId ? { ...it, status: ITEM_STATUS_NEXT[it.status] } : it
        ),
      }
    }))
  }

  const detailProject = projects.find((p) => p.id === detailId)

  const clientInvoices = form.clientId
    ? invoices.filter((i) => i.clientId === form.clientId)
    : []

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{projects.length} total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((s) => {
          const count = projects.filter((p) => p.status === s).length
          const cfg = PROJECT_STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={`rounded-xl border p-4 text-left transition ${statusFilter === s ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
            >
              <p className={`text-2xl font-bold ${statusFilter === s ? 'text-white' : 'text-zinc-900'}`}>{count}</p>
              <p className={`text-xs mt-0.5 ${statusFilter === s ? 'text-zinc-300' : 'text-zinc-500'}`}>{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, client, invoice…" className="flex-1" />
        <div className="flex gap-1.5">
          {(['all', 'active', 'completed', 'on-hold'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`h-9 px-3 rounded-lg text-xs font-medium border transition whitespace-nowrap ${statusFilter === f ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}
            >
              {f === 'all' ? 'All' : PROJECT_STATUS_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <svg className="w-10 h-10 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <p className="text-sm">No projects yet. Create your first one.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-zinc-400">
            <p className="text-sm">No projects match your filters.</p>
            <button onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-2 text-xs text-brand hover:underline">Clear filters</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Project</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden sm:table-cell">Client</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden md:table-cell">Invoice(s)</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden sm:table-cell">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paged.map((project, i) => {
                const client = clients.find((c) => c.id === project.clientId)
                const linkedInvoices = project.invoiceIds.map((id) => invoices.find((inv) => inv.id === id)).filter(Boolean)
                const doneCount = project.items.filter((it) => it.status === 'done').length
                const totalItems = project.items.length
                const sc = PROJECT_STATUS_CONFIG[project.status]
                return (
                  <tr key={project.id} className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailId(project.id)}
                        className="font-medium text-zinc-900 hover:text-brand transition text-left"
                      >
                        {project.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{client?.name ?? '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {linkedInvoices.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {linkedInvoices.map((inv) => inv && (
                            <span key={inv.id} className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                              {inv.number}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {totalItems > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500 transition-all"
                              style={{ width: `${(doneCount / totalItems) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{doneCount}/{totalItems}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetailId(project.id)}
                          className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition"
                          title="View scope items"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEdit(project)}
                          className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition"
                          title="Edit project"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(project.id)}
                          className="p-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition"
                          title="Delete project"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {/* ── Detail modal ──────────────────────────────────────────── */}
      {detailProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{detailProject.name}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {clients.find((c) => c.id === detailProject.clientId)?.name ?? '—'}
                  {detailProject.invoiceIds.length > 0 && (
                    <span> · {detailProject.invoiceIds.map((id) => invoices.find((i) => i.id === id)?.number).filter(Boolean).join(', ')}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROJECT_STATUS_CONFIG[detailProject.status].cls}`}>
                  {PROJECT_STATUS_CONFIG[detailProject.status].label}
                </span>
                <button
                  onClick={() => { setDetailId(null); openEdit(detailProject) }}
                  className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition"
                >
                  Edit
                </button>
                <button onClick={() => setDetailId(null)} className="text-zinc-400 hover:text-zinc-700 transition ml-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scope items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailProject.items.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8">No scope items. Edit project to add them.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-zinc-700">Scope of Work</p>
                    <p className="text-xs text-zinc-400">
                      {detailProject.items.filter((it) => it.status === 'done').length}/{detailProject.items.length} done
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {detailProject.items.map((item) => {
                      const cfg = ITEM_STATUS_CONFIG[item.status]
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 transition">
                          <button
                            onClick={() => cycleDetailItemStatus(detailProject.id, item.id)}
                            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition hover:opacity-80 ${cfg.cls}`}
                            title="Click to cycle status"
                          >
                            {cfg.label}
                          </button>
                          <span className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                            {item.description}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-4 pt-4 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-zinc-500">Overall progress</span>
                      <span className="text-xs font-medium text-zinc-700">
                        {Math.round((detailProject.items.filter((it) => it.status === 'done').length / detailProject.items.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${(detailProject.items.filter((it) => it.status === 'done').length / detailProject.items.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 shrink-0">
              <p className="text-xs text-zinc-400">Click a status badge to cycle: To Do → In Progress → Done</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit modal ──────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">{editingId ? 'Edit project' : 'New project'}</h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-700 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

              {/* Client */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Client *</label>
                <select
                  value={form.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Project Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={selectedClient ? selectedClient.name : 'e.g. Wedding Video Package'}
                  className="h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                />
                {selectedClient && !form.name && (
                  <button
                    onClick={() => setForm((p) => ({ ...p, name: selectedClient.name }))}
                    className="self-start text-xs text-brand hover:underline"
                  >
                    Use &quot;{selectedClient.name}&quot;
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((s) => {
                    const cfg = PROJECT_STATUS_CONFIG[s]
                    const active = form.status === s
                    return (
                      <button
                        key={s}
                        onClick={() => setForm((p) => ({ ...p, status: s }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? `${cfg.cls} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Link Invoices */}
              {clientInvoices.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Linked Invoice(s)</label>
                  <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-3">
                    {clientInvoices.map((inv) => (
                      <label key={inv.id} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.invoiceIds.includes(inv.id)}
                          onChange={() => toggleInvoice(inv.id)}
                          className="rounded border-zinc-300 text-brand focus:ring-brand"
                        />
                        <span className="text-sm text-zinc-700">{inv.number}</span>
                        <span className="text-xs text-zinc-400">{inv.date}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope items */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">Scope of Work</label>
                  {form.items.length > 0 && (
                    <span className="text-xs text-zinc-400">{form.items.filter((it) => it.status === 'done').length}/{form.items.length} done</span>
                  )}
                </div>

                {form.items.length === 0 && form.clientId && (
                  <button
                    onClick={() => setForm((p) => ({
                      ...p,
                      items: scopeOfWork.map((desc) => ({ id: uid(), description: desc, status: 'todo' as ProjectItemStatus })),
                    }))}
                    className="self-start text-xs text-brand hover:underline"
                  >
                    Load from global scope list
                  </button>
                )}

                {form.items.map((item) => {
                  const cfg = ITEM_STATUS_CONFIG[item.status]
                  return (
                    <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-100 group">
                      <button
                        onClick={() => cycleItemStatus(item.id)}
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition hover:opacity-80 ${cfg.cls}`}
                        title="Click to cycle status"
                      >
                        {cfg.label}
                      </button>
                      <span className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                        {item.description}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}

                {/* Add item */}
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addScopeItem() } }}
                    placeholder="Add scope item…"
                    list="scope-suggestions-proj"
                    className="flex-1 h-9 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                  />
                  <datalist id="scope-suggestions-proj">
                    {scopeOfWork.map((s) => <option key={s} value={s} />)}
                  </datalist>
                  <button
                    onClick={addScopeItem}
                    className="h-9 px-3 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {formError && <p className="px-6 py-2 text-sm text-red-600 shrink-0">{formError}</p>}

            <div className="flex gap-3 px-6 py-4 border-t border-zinc-100 justify-end shrink-0">
              <button onClick={closeModal} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={handleSave} className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
                {editingId ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────── */}
      {deleteId && (
        <ModalShell onClose={() => setDeleteId(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Delete project?</h2>
            <p className="text-sm text-zinc-500 mb-6">This will permanently delete the project and its scope items.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
