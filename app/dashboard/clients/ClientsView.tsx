'use client'

import { useState, useEffect } from 'react'
import { useStore, type Client, type Invoice, type InvoiceStatus, type ProjectItemStatus } from '../AppStore'
import { calcEarned, calcSubtotal } from '@/app/_services/invoiceService'
import { fmtUSD } from '@/app/_lib/formatters'
import { uid } from '@/app/_lib/id'
import { PAGE_SIZE, STORAGE_KEYS } from '@/app/_config/constants'
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG, ITEM_STATUS_CONFIG, ITEM_STATUS_NEXT } from '@/app/_config/statusConfig'
import SortTh      from '@/app/_components/SortTh'
import SearchInput from '@/app/_components/SearchInput'
import Pagination  from '@/app/_components/Pagination'
import FormField   from '@/app/_components/FormField'
import ModalShell  from '@/app/_components/ModalShell'
import InvoicePreviewModal  from '@/app/_components/InvoicePreviewModal'
import ProjectDetailModal   from '@/app/_components/ProjectDetailModal'

const fmt = fmtUSD
const EMPTY_FORM: Omit<Client, 'id'> = { name: '', contactPerson: '', phone: '', address: '', email: '' }
type CliSortCol = 'name' | 'invoices' | 'earned'

const inputCls = 'h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition w-full bg-white'

export default function ClientsView() {
  const { clients, setClients, invoices, projects, setProjects } = useStore()

  const [search, setSearch] = useState('')

  const filteredClients = search.trim()
    ? clients.filter((c) => {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
               c.phone.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
      })
    : clients

  // ── Sort ───────────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<CliSortCol>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.tableCliCol) as CliSortCol) ?? 'name' : 'name'
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.tableCliDir) as 'asc' | 'desc') ?? 'asc' : 'asc'
  )
  const [page, setPage] = useState<number>(() =>
    typeof window !== 'undefined' ? parseInt(localStorage.getItem(STORAGE_KEYS.tableCliPage) ?? '1') || 1 : 1
  )

  function handleSort(col: string) {
    const nextDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc'
    setSortCol(col as CliSortCol); setSortDir(nextDir); setPage(1)
    localStorage.setItem(STORAGE_KEYS.tableCliCol, col)
    localStorage.setItem(STORAGE_KEYS.tableCliDir, nextDir)
    localStorage.setItem(STORAGE_KEYS.tableCliPage, '1')
  }
  function goToPage(p: number) { setPage(p); localStorage.setItem(STORAGE_KEYS.tableCliPage, String(p)) }

  // Earned = cash actually received (paid + deposit portions)
  const statsMap = new Map(clients.map((c) => {
    const ci     = invoices.filter((inv) => inv.clientId === c.id)
    const earned = ci.reduce((s, inv) => s + calcEarned(inv), 0)
    return [c.id, { count: ci.length, earned }]
  }))

  const sortedClients = [...filteredClients].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'name')     cmp = a.name.localeCompare(b.name)
    if (sortCol === 'invoices') cmp = (statsMap.get(a.id)?.count ?? 0)  - (statsMap.get(b.id)?.count ?? 0)
    if (sortCol === 'earned')   cmp = (statsMap.get(a.id)?.earned ?? 0) - (statsMap.get(b.id)?.earned ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages   = Math.max(1, Math.ceil(sortedClients.length / PAGE_SIZE))
  const safePage     = Math.min(page, totalPages)
  const pagedClients = sortedClients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { goToPage(1) }, [clients.length, search]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client add/edit modal ──────────────────────────────────────────────────
  const [modalOpen, setModalOpen]         = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [formError, setFormError]         = useState('')
  const [deleteId, setDeleteId]           = useState<string | null>(null)

  function openAdd()  { setEditingClient(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true) }
  function openEdit(client: Client) {
    setEditingClient(client)
    setForm({ name: client.name, contactPerson: client.contactPerson ?? '', phone: client.phone, address: client.address, email: client.email })
    setFormError(''); setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditingClient(null); setForm(EMPTY_FORM); setFormError('') }

  function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required.'); return }
    if (editingClient) {
      setClients(clients.map((c) => (c.id === editingClient.id ? { ...editingClient, ...form } : c)))
    } else {
      setClients([...clients, { id: uid(), ...form }])
    }
    closeModal()
  }
  function handleDelete(id: string) { setClients(clients.filter((c) => c.id !== id)); setDeleteId(null) }

  // ── Invoice preview ────────────────────────────────────────────────────────
  const [previewInvId, setPreviewInvId] = useState<string | null>(null)

  // ── Client invoices popup ──────────────────────────────────────────────────
  const [invoicesClientId, setInvoicesClientId] = useState<string | null>(null)

  // ── Client projects popup ──────────────────────────────────────────────────
  const [projectsClientId, setProjectsClientId] = useState<string | null>(null)

  // ── View project progress ──────────────────────────────────────────────────
  const [viewProjectId, setViewProjectId] = useState<string | null>(null)

  // ── Link / create project (from invoices popup) ────────────────────────────
  const [linkProjectInvId, setLinkProjectInvId] = useState<string | null>(null)
  const [cpMode,     setCpMode]     = useState<'create' | 'link'>('create')
  const [cpName,     setCpName]     = useState('')
  const [cpItems,    setCpItems]    = useState<{ id: string; description: string; status: ProjectItemStatus }[]>([])
  const [cpExcluded, setCpExcluded] = useState<Set<string>>(new Set())
  const [cpLinkId,   setCpLinkId]   = useState('')

  function openLinkProject(inv: Invoice) {
    const client         = clients.find((c) => c.id === inv.clientId)
    const clientProjects = projects.filter((p) => p.clientId === inv.clientId && !p.invoiceIds.includes(inv.id))
    setCpMode(clientProjects.length > 0 ? 'link' : 'create')
    setCpName(client?.name ?? '')
    setCpItems(inv.items.filter((it) => it.description.trim()).map((it) => ({ id: uid(), description: it.description, status: 'todo' as ProjectItemStatus })))
    setCpExcluded(new Set())
    setCpLinkId(clientProjects[0]?.id ?? '')
    setLinkProjectInvId(inv.id)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Clients</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{clients.length} total</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add client
        </button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, phone, address…" className="mb-3" />

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <svg className="w-10 h-10 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">No clients yet. Add your first one.</p>
          </div>
        ) : sortedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-zinc-400">
            <p className="text-sm">No clients match your search.</p>
            <button onClick={() => setSearch('')} className="mt-2 text-xs text-brand hover:underline">Clear search</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <SortTh col="name"     active={sortCol} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3">Name</SortTh>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden lg:table-cell">Address</th>
                <SortTh col="invoices" active={sortCol} dir={sortDir} onSort={handleSort} className="text-center px-4 py-3 hidden sm:table-cell">Invoices</SortTh>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 hidden md:table-cell">Projects</th>
                <SortTh col="earned"   active={sortCol} dir={sortDir} onSort={handleSort} className="text-right px-4 py-3">Earned</SortTh>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pagedClients.map((client, i) => {
                const stats        = statsMap.get(client.id)
                const clientProjects = projects.filter((p) => p.clientId === client.id)
                const projectCount   = clientProjects.length
                const allDone        = clientProjects.reduce((s, p) => s + p.items.filter(it => it.status === 'done').length, 0)
                const allItems       = clientProjects.reduce((s, p) => s + p.items.length, 0)
                const aggPct         = allItems > 0 ? Math.round((allDone / allItems) * 100) : 0
                return (
                  <tr key={client.id} className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{client.name}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{client.email}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">{client.phone || '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 max-w-xs truncate hidden lg:table-cell">{client.address || '—'}</td>
                    {/* Invoices count — clickable */}
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {stats && stats.count > 0 ? (
                        <button
                          onClick={() => setInvoicesClientId(client.id)}
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
                        >
                          {stats.count}
                        </button>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    {/* Projects — inline progress bar, same style as invoice table */}
                    <td className="px-4 py-3 hidden md:table-cell w-40">
                      {projectCount > 0 ? (
                        <button
                          onClick={() => projectCount === 1 ? setViewProjectId(clientProjects[0].id) : setProjectsClientId(client.id)}
                          className="w-full text-left group"
                          title={`${projectCount} project${projectCount !== 1 ? 's' : ''} — ${aggPct}%`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition truncate max-w-[96px]">
                              {projectCount === 1 ? clientProjects[0].name : `${projectCount} projects`}
                            </span>
                            <span className="text-xs text-zinc-400 shrink-0">{aggPct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${aggPct === 100 ? 'bg-green-500' : 'bg-brand'}`}
                              style={{ width: `${Math.max(aggPct, aggPct > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                        </button>
                      ) : stats?.count ? (
                        <button
                          onClick={() => setInvoicesClientId(client.id)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-brand transition group"
                        >
                          <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          Link project
                        </button>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {stats && stats.count > 0 ? fmt(stats.earned) : <span className="text-zinc-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(client)} className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition">Edit</button>
                        <button onClick={() => setDeleteId(client.id)} className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={safePage} totalPages={totalPages} totalItems={sortedClients.length} pageSize={PAGE_SIZE} onPageChange={goToPage} />

      {/* ── Add / Edit client ──────────────────────────────────────────────────── */}
      {modalOpen && (
        <ModalShell onClose={closeModal}>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-5">{editingClient ? 'Edit client' : 'Add client'}</h2>
            <div className="flex flex-col gap-4">
              <FormField label="Company Name" id="name" required value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="ANYMIND (Cambodia) CO.,LTD" />
              <FormField label="Contact Person (To)" id="contactPerson" value={form.contactPerson ?? ''} onChange={(v) => setForm((p) => ({ ...p, contactPerson: v }))} placeholder="Mr. Siv Chinh" />
              <FormField label="Email" id="email" type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="billing@example.com" />
              <FormField label="Phone" id="phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="+855 23 901 415" />
              <FormField label="Address" id="address" value={form.address} onChange={(v) => setForm((p) => ({ ...p, address: v }))} placeholder="16/F, Phnom Penh Tower, No 445, St. Monivong, Phnom Penh, Cambodia" />
            </div>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={closeModal} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={handleSave} className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
                {editingClient ? 'Save changes' : 'Add client'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────────── */}
      {deleteId && (
        <ModalShell onClose={() => setDeleteId(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Delete client?</h2>
            <p className="text-sm text-zinc-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Client invoices popup ──────────────────────────────────────────────── */}
      {invoicesClientId && (() => {
        const client        = clients.find((c) => c.id === invoicesClientId)
        const clientInvs    = invoices.filter((inv) => inv.clientId === invoicesClientId)
        return (
          <ModalShell onClose={() => setInvoicesClientId(null)} maxWidth="max-w-3xl">
            <div className="flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{client?.name}</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">{clientInvs.length} invoice{clientInvs.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setInvoicesClientId(null)} className="text-zinc-400 hover:text-zinc-700 transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {clientInvs.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-10">No invoices for this client.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Invoice #</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell">Date</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden md:table-cell w-40">Project</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {clientInvs.map((inv, i) => {
                        const sub = calcSubtotal(inv)
                        const sc  = STATUS_CONFIG[inv.status ?? 'draft']
                        const linkedProject = projects.find((p) => p.invoiceIds.includes(inv.id))
                        const doneCount     = linkedProject?.items.filter((it) => it.status === 'done').length ?? 0
                        const totalItems    = linkedProject?.items.length ?? 0
                        const pct           = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0
                        return (
                          <tr key={inv.id} className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 ${i % 2 === 1 ? 'bg-zinc-50/30' : ''}`}>
                            {/* Invoice # — clickable */}
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setPreviewInvId(inv.id)}
                                className="font-medium text-zinc-900 hover:text-brand hover:underline transition text-left"
                              >
                                {inv.number}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 whitespace-nowrap hidden sm:table-cell">{inv.date}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="font-medium text-zinc-900">{fmt(sub)}</span>
                            </td>
                            {/* Project column */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              {linkedProject ? (
                                <button onClick={() => setViewProjectId(linkedProject.id)} className="w-full text-left group" title={`${linkedProject.name} — ${pct}%`}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition truncate max-w-[96px]">{linkedProject.name}</span>
                                    <span className="text-xs text-zinc-400 shrink-0">{pct}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`} style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }} />
                                  </div>
                                </button>
                              ) : (
                                <button onClick={() => openLinkProject(inv)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-brand transition group">
                                  <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                  Link project
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <a href={`/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition inline-flex" title="PDF">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── Client projects popup ──────────────────────────────────────────────── */}
      {projectsClientId && (() => {
        const client         = clients.find((c) => c.id === projectsClientId)
        const clientProjects = projects.filter((p) => p.clientId === projectsClientId)
        return (
          <ModalShell onClose={() => setProjectsClientId(null)} maxWidth="max-w-lg">
            <div className="flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{client?.name}</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">{clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setProjectsClientId(null)} className="text-zinc-400 hover:text-zinc-700 transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
                {clientProjects.map((project) => {
                  const linkedInvs = project.invoiceIds.map((id) => invoices.find((i) => i.id === id)).filter(Boolean) as typeof invoices
                  const earned     = linkedInvs.reduce((sum, inv) => sum + calcEarned(inv), 0)
                  const doneCount  = project.items.filter((it) => it.status === 'done').length
                  const totalItems = project.items.length
                  const pct        = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0
                  const sc         = PROJECT_STATUS_CONFIG[project.status]
                  return (
                    <div key={project.id} className="rounded-xl border border-zinc-200 p-4 hover:border-zinc-300 transition cursor-pointer" onClick={() => setViewProjectId(project.id)}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 truncate">{project.name}</p>
                          {linkedInvs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {linkedInvs.map((inv) => (
                                <button
                                  key={inv.id}
                                  onClick={() => setPreviewInvId(inv.id)}
                                  className="text-xs text-brand hover:underline"
                                >
                                  {inv.number}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                          {earned > 0 && <span className="text-sm font-semibold text-zinc-900">{fmt(earned)}</span>}
                        </div>
                      </div>
                      {totalItems > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500 shrink-0">{doneCount}/{totalItems} · {pct}%</span>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">No scope items</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── Project detail ──────────────────────────────────────────────────────── */}
      {viewProjectId && <ProjectDetailModal projectId={viewProjectId} onClose={() => setViewProjectId(null)} />}

      {/* ── Link / Create project (from invoices popup) ─────────────────────────── */}
      {linkProjectInvId && (() => {
        const inv            = invoices.find((i) => i.id === linkProjectInvId)
        const client         = inv ? clients.find((c) => c.id === inv.clientId) : null
        const clientProjects = inv ? projects.filter((p) => p.clientId === inv.clientId && !p.invoiceIds.includes(inv.id)) : []
        return (
          <ModalShell onClose={() => setLinkProjectInvId(null)}>
            <div className="flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Link project</h2>
                  {inv && <p className="text-xs text-zinc-400 mt-0.5">{inv.number} · {client?.name ?? '—'}</p>}
                </div>
                <button onClick={() => setLinkProjectInvId(null)} className="text-zinc-400 hover:text-zinc-700 transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {clientProjects.length > 0 && (
                <div className="flex border-b border-zinc-200 shrink-0">
                  {(['link', 'create'] as const).map((m) => (
                    <button key={m} onClick={() => setCpMode(m)} className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition ${cpMode === m ? 'border-brand text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
                      {m === 'link' ? 'Link existing' : 'Create new'}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                {cpMode === 'link' && clientProjects.length > 0 ? (
                  <>
                    <p className="text-sm text-zinc-500">Pick an existing project to attach this invoice to.</p>
                    <div className="flex flex-col gap-2">
                      {clientProjects.map((p) => {
                        const done  = p.items.filter((it) => it.status === 'done').length
                        const total = p.items.length
                        const pct   = total > 0 ? Math.round((done / total) * 100) : 0
                        return (
                          <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${cpLinkId === p.id ? 'border-brand bg-amber-50/40' : 'border-zinc-200 hover:border-zinc-300'}`}>
                            <input type="radio" name="linkProject" value={p.id} checked={cpLinkId === p.id} onChange={() => setCpLinkId(p.id)} className="text-brand" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900">{p.name}</p>
                              {total > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-zinc-400 shrink-0">{pct}%</span>
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-zinc-700">Project name</label>
                      <input type="text" value={cpName} onChange={(e) => setCpName(e.target.value)} placeholder={client?.name ?? 'Project name…'} className={inputCls} />
                      {client && !cpName && (
                        <button onClick={() => setCpName(client.name)} className="self-start text-xs text-brand hover:underline">Use &quot;{client.name}&quot;</button>
                      )}
                    </div>
                    {cpItems.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-zinc-700">Scope items from invoice</label>
                        <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-3 max-h-48 overflow-y-auto">
                          {cpItems.map((item) => (
                            <label key={item.id} className="flex items-center gap-2.5 cursor-pointer">
                              <input type="checkbox" checked={!cpExcluded.has(item.id)} onChange={() => setCpExcluded((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })} className="rounded border-zinc-300 text-brand focus:ring-brand" />
                              <span className={`text-sm ${cpExcluded.has(item.id) ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{item.description}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-400">Uncheck items to exclude from project.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-zinc-100 justify-end shrink-0">
                <button onClick={() => setLinkProjectInvId(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
                <button
                  onClick={() => {
                    if (!inv) return
                    if (cpMode === 'link' && cpLinkId) {
                      setProjects(projects.map((p) => p.id === cpLinkId ? { ...p, invoiceIds: [...p.invoiceIds, inv.id] } : p))
                    } else {
                      const name = cpName.trim() || (client?.name ?? 'New Project')
                      setProjects([...projects, { id: uid(), name, clientId: inv.clientId, invoiceIds: [inv.id], items: cpItems.filter((it) => !cpExcluded.has(it.id)), status: 'active', createdAt: new Date().toISOString() }])
                    }
                    setLinkProjectInvId(null); setCpName(''); setCpItems([]); setCpExcluded(new Set()); setCpLinkId('')
                  }}
                  className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
                >
                  {cpMode === 'link' ? 'Link project' : 'Create project'}
                </button>
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── Invoice preview ─────────────────────────────────────────────────────── */}
      {previewInvId && <InvoicePreviewModal invId={previewInvId} onClose={() => setPreviewInvId(null)} />}
    </>
  )
}
