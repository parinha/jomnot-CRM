'use client'

import { useState, useEffect } from 'react'
import { useStore, type Invoice, type LineItem, type InvoiceStatus, type ProjectItemStatus } from '../AppStore'
import { calcInvoiceTotal, calcSubtotal } from '@/app/_services/invoiceService'
import { fmtUSD } from '@/app/_lib/formatters'
import { uid } from '@/app/_lib/id'
import { WHT_RATE, PAYMENT_TERMS, PAGE_SIZE, STORAGE_KEYS } from '@/app/_config/constants'
import { STATUS_CONFIG, ITEM_STATUS_CONFIG, ITEM_STATUS_NEXT } from '@/app/_config/statusConfig'
import SortTh      from '@/app/_components/SortTh'
import SearchInput from '@/app/_components/SearchInput'
import Pagination  from '@/app/_components/Pagination'
import ModalShell  from '@/app/_components/ModalShell'

// ── Local helpers ─────────────────────────────────────────────────────────────
const fmt = fmtUSD

function nextInvoiceNumber(invoices: Invoice[]): string {
  const year  = new Date().getFullYear()
  const count = invoices.filter((inv) => inv.number.startsWith(`INV-${year}`)).length
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`
}

function emptyItem(): LineItem {
  return { id: uid(), description: '', qty: 1, unitPrice: 0 }
}

type FormState = Omit<Invoice, 'id'>

const inputCls = 'h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition w-full bg-white'

// ── Component ─────────────────────────────────────────────────────────────────
export default function InvoicesView() {
  const { clients, invoices, setInvoices, projects, setProjects, scopeOfWork } = useStore()

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalCount      = invoices.length
  const paidInvoices    = invoices.filter((inv) => inv.status === 'paid')
  const depositInvoices = invoices.filter((inv) => inv.depositPercent != null)
  const noDepositInvoices = invoices.filter((inv) => inv.depositPercent == null)
  const awaitingBalance = invoices.filter((inv) => inv.status === 'partial')
  const paidRevenue     = paidInvoices.reduce((s, inv) => s + calcInvoiceTotal(inv), 0)
  const depositRevenue  = awaitingBalance.reduce((s, inv) => {
    return s + calcInvoiceTotal(inv) * ((inv.depositPercent ?? 0) / 100)
  }, 0)

  // ── Panel (add / edit invoice) ─────────────────────────────────────────────
  const [panelOpen, setPanelOpen]   = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [formError, setFormError]   = useState('')

  const blankForm = (): FormState => ({
    number: nextInvoiceNumber(invoices),
    date: new Date().toISOString().slice(0, 10),
    paymentTerms: 'Due on receipt',
    status: 'draft',
    clientId: '',
    items: [emptyItem()],
    wht: false,
    notes: '',
    depositPercent: undefined,
  })

  const [form, setForm] = useState<FormState>(blankForm)

  function openNew() {
    setEditingId(null); setForm(blankForm()); setFormError(''); setPanelOpen(true)
  }
  function openEdit(inv: Invoice) {
    setEditingId(inv.id)
    setForm({ number: inv.number, date: inv.date, paymentTerms: inv.paymentTerms ?? 'Due on receipt', status: inv.status ?? 'draft', clientId: inv.clientId, items: inv.items, wht: inv.wht, notes: inv.notes, depositPercent: inv.depositPercent })
    setFormError('')
    setPanelOpen(true)
  }
  function closePanel() { setPanelOpen(false); setEditingId(null); setFormError('') }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  function addItem()               { setField('items', [...form.items, emptyItem()]) }
  function removeItem(id: string)  { if (form.items.length > 1) setField('items', form.items.filter((it) => it.id !== id)) }
  function updateItem(id: string, patch: Partial<LineItem>) {
    setField('items', form.items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function handleSave() {
    if (!form.clientId)  { setFormError('Please select a client.'); return }
    if (!form.number.trim()) { setFormError('Invoice number is required.'); return }
    if (form.items.some((it) => !it.description.trim())) { setFormError('All line items need a description.'); return }
    if (editingId) {
      setInvoices(invoices.map((inv) => (inv.id === editingId ? { id: editingId, ...form } : inv)))
    } else {
      setInvoices([...invoices, { id: uid(), ...form }])
    }
    closePanel()
  }

  const subtotal     = form.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
  const whtAmount    = subtotal * WHT_RATE
  const grandTotal   = form.wht ? subtotal + whtAmount : subtotal
  const depositAmount = form.depositPercent != null ? grandTotal * (form.depositPercent / 100) : 0
  const balanceDue   = grandTotal - depositAmount

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [statusChange, setStatusChange] = useState<{ id: string; from: InvoiceStatus; to: InvoiceStatus } | null>(null)

  const [createProjectInvId, setCreateProjectInvId] = useState<string | null>(null)
  const [cpName,    setCpName]    = useState('')
  const [cpItems,   setCpItems]   = useState<{ id: string; description: string; status: ProjectItemStatus }[]>([])
  const [cpExcluded, setCpExcluded] = useState<Set<string>>(new Set())
  const [viewProjectId, setViewProjectId] = useState<string | null>(null)

  function handleDelete(id: string) {
    setInvoices(invoices.filter((inv) => inv.id !== id)); setDeleteId(null)
  }
  function confirmStatusChange() {
    if (!statusChange) return
    setInvoices(invoices.map((inv) => (inv.id === statusChange.id ? { ...inv, status: statusChange.to } : inv)))
    setStatusChange(null)
  }

  // ── Filter / sort / paginate ────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all' | 'active'>('all')

  type InvSortCol = 'number' | 'date' | 'paymentTerms' | 'amount'
  const [sortCol, setSortCol] = useState<InvSortCol>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.tableInvCol) as InvSortCol) ?? 'number' : 'number'
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.tableInvDir) as 'asc' | 'desc') ?? 'asc' : 'asc'
  )
  const [page, setPage] = useState<number>(() =>
    typeof window !== 'undefined' ? parseInt(localStorage.getItem(STORAGE_KEYS.tableInvPage) ?? '1') || 1 : 1
  )

  function handleSort(col: string) {
    const nextDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc'
    setSortCol(col as InvSortCol); setSortDir(nextDir); setPage(1)
    localStorage.setItem(STORAGE_KEYS.tableInvCol, col)
    localStorage.setItem(STORAGE_KEYS.tableInvDir, nextDir)
    localStorage.setItem(STORAGE_KEYS.tableInvPage, '1')
  }
  function goToPage(p: number) { setPage(p); localStorage.setItem(STORAGE_KEYS.tableInvPage, String(p)) }

  useEffect(() => { goToPage(1) }, [search, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'active' && inv.status !== 'sent' && inv.status !== 'partial') return false
    if (statusFilter !== 'all' && statusFilter !== 'active' && inv.status !== statusFilter) return false
    if (search.trim()) {
      const q       = search.toLowerCase()
      const client  = clients.find((c) => c.id === inv.clientId)
      const sub     = calcSubtotal(inv)
      const total   = calcInvoiceTotal(inv)
      const depAmt  = inv.depositPercent != null ? total * (inv.depositPercent / 100) : null
      const balance = depAmt != null ? total - depAmt : total
      const haystack = [inv.number, client?.name ?? '', client?.phone ?? '', client?.email ?? '',
        fmt(sub), fmt(total), depAmt != null ? fmt(depAmt) : '', fmt(balance)].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'number') {
      const n = (s: string) => parseInt(s.split('-').pop() ?? '0') + s.split('-').slice(0, -1).join('')
      cmp = n(a.number) < n(b.number) ? -1 : n(a.number) > n(b.number) ? 1 : 0
    } else if (sortCol === 'date') {
      cmp = a.date.localeCompare(b.date)
    } else if (sortCol === 'paymentTerms') {
      cmp = (a.paymentTerms ?? '').localeCompare(b.paymentTerms ?? '')
    } else if (sortCol === 'amount') {
      cmp = calcSubtotal(a) - calcSubtotal(b)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
  const totalPages    = Math.max(1, Math.ceil(sortedInvoices.length / PAGE_SIZE))
  const safePage      = Math.min(page, totalPages)
  const pagedInvoices = sortedInvoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{invoices.length} total</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New invoice
        </button>
      </div>

      {/* Summary widgets */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">Completed</p>
            <p className="text-2xl font-bold text-zinc-900">{paidInvoices.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{fmt(paidRevenue)} received</p>
            <div className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Paid</div>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">With Deposit</p>
            <p className="text-2xl font-bold text-zinc-900">{depositInvoices.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{awaitingBalance.length} awaiting balance</p>
            <div className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">{fmt(depositRevenue)} collected</div>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">Pay on Delivery</p>
            <p className="text-2xl font-bold text-zinc-900">{noDepositInvoices.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">no upfront deposit</p>
            <div className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium">Full on finish</div>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">All Invoices</p>
            <p className="text-2xl font-bold text-zinc-900">{totalCount}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {invoices.filter((i) => i.status === 'overdue').length} overdue · {invoices.filter((i) => i.status === 'draft').length} draft
            </p>
            <div className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              {invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length} active
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice #, client name, amount…" className="flex-1" />
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: 'all',    label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'partial', label: 'Deposit Rcvd' },
            { key: 'paid',   label: 'Paid' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'draft',  label: 'Draft' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`h-9 px-3 rounded-lg text-xs font-medium border transition whitespace-nowrap ${statusFilter === key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}
            >
              {label}
              {key !== 'all' && key !== 'active' && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === key ? 'bg-white/20' : 'bg-zinc-100'}`}>
                  {invoices.filter((i) => i.status === key).length}
                </span>
              )}
              {key === 'active' && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === key ? 'bg-white/20' : 'bg-zinc-100'}`}>
                  {invoices.filter((i) => i.status === 'sent' || i.status === 'partial').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <svg className="w-10 h-10 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No invoices yet. Create your first one.</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-zinc-400">
            <p className="text-sm">No invoices match your search.</p>
            <button onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-2 text-xs text-brand hover:underline">Clear filters</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <SortTh col="number"       active={sortCol} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3">Invoice #</SortTh>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Client</th>
                <SortTh col="date"         active={sortCol} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3 hidden sm:table-cell">Date</SortTh>
                <SortTh col="paymentTerms" active={sortCol} dir={sortDir} onSort={handleSort} className="text-left px-4 py-3 hidden md:table-cell">Terms</SortTh>
                <SortTh col="amount"       active={sortCol} dir={sortDir} onSort={handleSort} className="text-right px-4 py-3">Amount</SortTh>
                <th className="text-right px-4 py-3 font-medium text-zinc-500 hidden md:table-cell">Balance</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pagedInvoices.map((inv, i) => {
                const client       = clients.find((c) => c.id === inv.clientId)
                const sub          = calcSubtotal(inv)
                const clientTotal  = calcInvoiceTotal(inv)
                const invDeposit   = inv.depositPercent != null ? clientTotal * (inv.depositPercent / 100) : null
                const invBalance   = invDeposit != null ? clientTotal - invDeposit : null
                const status: InvoiceStatus = inv.status ?? 'draft'
                const sc           = STATUS_CONFIG[status]
                const linkedProject = projects.find((p) => p.invoiceIds.includes(inv.id))
                return (
                  <tr key={inv.id} className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">{inv.number}</td>
                    <td className="px-4 py-3 text-zinc-600 max-w-[120px] truncate">{client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap hidden sm:table-cell">{inv.date}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap hidden md:table-cell">{inv.paymentTerms ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900 whitespace-nowrap">{fmt(sub)}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <div className="flex flex-col items-end gap-0.5">
                        {inv.wht && <span className="text-amber-700 font-medium whitespace-nowrap text-xs">{fmt(clientTotal)} total</span>}
                        {invBalance != null && (
                          <span className={`font-medium whitespace-nowrap text-xs ${inv.status === 'partial' ? 'text-green-700' : 'text-zinc-500'}`}>
                            {fmt(invDeposit!)} dep · {fmt(invBalance)} bal
                          </span>
                        )}
                        {!inv.wht && invBalance == null && <span className="text-zinc-400 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={status}
                        onChange={(e) => { const next = e.target.value as InvoiceStatus; if (next !== status) setStatusChange({ id: inv.id, from: status, to: next }) }}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 ${sc.cls}`}
                      >
                        {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === 'sent' && inv.depositPercent != null && (
                          <button onClick={() => setStatusChange({ id: inv.id, from: 'sent', to: 'partial' })} className="h-7 px-2.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 transition whitespace-nowrap" title="Mark deposit as received">Accept Deposit</button>
                        )}
                        {status === 'partial' && (
                          <button onClick={() => setStatusChange({ id: inv.id, from: 'partial', to: 'paid' })} className="h-7 px-2.5 rounded-md bg-green-100 text-green-800 text-xs font-medium hover:bg-green-200 transition whitespace-nowrap" title="Mark final payment received">Final Payment</button>
                        )}
                        {status === 'sent' && inv.depositPercent == null && (
                          <button onClick={() => setStatusChange({ id: inv.id, from: 'sent', to: 'paid' })} className="h-7 px-2.5 rounded-md bg-green-100 text-green-800 text-xs font-medium hover:bg-green-200 transition whitespace-nowrap" title="Mark as fully paid">Mark Paid</button>
                        )}
                        {/* Project button */}
                        {linkedProject ? (
                          <button
                            onClick={() => setViewProjectId(linkedProject.id)}
                            className="p-1.5 rounded-md border border-blue-200 text-blue-500 bg-blue-50 hover:bg-blue-100 transition"
                            title={`Project: ${linkedProject.name} — click to view`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const c = clients.find((c) => c.id === inv.clientId)
                              setCpName(c?.name ?? '')
                              setCpItems(scopeOfWork.map((desc) => ({ id: uid(), description: desc, status: 'todo' as ProjectItemStatus })))
                              setCpExcluded(new Set())
                              setCreateProjectInvId(inv.id)
                            }}
                            className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
                            title="Create project from this invoice"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                          </button>
                        )}
                        <a href={`/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition" title="PDF">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </a>
                        <button onClick={() => openEdit(inv)} className="p-1.5 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteId(inv.id)} className="p-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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

      <Pagination page={safePage} totalPages={totalPages} totalItems={sortedInvoices.length} pageSize={PAGE_SIZE} onPageChange={goToPage} />

      {/* ── Slide-in invoice form panel ──────────────────────────────────────── */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 w-full md:max-w-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">{editingId ? 'Edit invoice' : 'New invoice'}</h2>
              <button onClick={closePanel} className="text-zinc-400 hover:text-zinc-700 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <PanelField label="Invoice Number" required><input value={form.number} onChange={(e) => setField('number', e.target.value)} className={inputCls} placeholder="INV-2025-001" /></PanelField>
                <PanelField label="Date" required><input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className={inputCls} /></PanelField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <PanelField label="Client" required>
                  <select value={form.clientId} onChange={(e) => setField('clientId', e.target.value)} className={inputCls}>
                    <option value="">Select a client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </PanelField>
                <PanelField label="Payment Terms">
                  <select value={form.paymentTerms} onChange={(e) => setField('paymentTerms', e.target.value)} className={inputCls}>
                    {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </PanelField>
              </div>
              <PanelField label="Status">
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => {
                    const active = form.status === s
                    const sc     = STATUS_CONFIG[s]
                    return (
                      <button key={s} onClick={() => setField('status', s)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? `${sc.cls} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}>
                        {sc.label}
                      </button>
                    )
                  })}
                </div>
              </PanelField>
              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-700">Line Items</span>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                  <datalist id="scope-suggestions">
                    {scopeOfWork.map((s) => <option key={s} value={s} />)}
                  </datalist>
                  {form.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-px bg-zinc-200">
                      <input list="scope-suggestions" value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Scope of work…" className="bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-zinc-50" />
                      <input type="number" min={0} value={item.qty === 0 ? '' : item.qty} onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })} className="bg-white px-3 py-2 text-sm text-center text-zinc-900 focus:outline-none focus:bg-zinc-50" />
                      <input type="number" min={0} value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} className="bg-white px-3 py-2 text-sm text-right text-zinc-900 focus:outline-none focus:bg-zinc-50" />
                      <div className="bg-white px-3 py-2 text-sm text-right text-zinc-700 font-medium">{fmt(item.qty * item.unitPrice)}</div>
                      <button onClick={() => removeItem(item.id)} disabled={form.items.length === 1} className="bg-white flex items-center justify-center text-zinc-300 hover:text-red-500 disabled:opacity-0 transition">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col items-end gap-1.5 text-sm">
                  <div className="flex gap-8"><span className="text-zinc-500">Subtotal</span><span className="font-medium text-zinc-900 w-28 text-right">{fmt(subtotal)}</span></div>
                  {form.wht && <div className="flex gap-8 text-amber-700"><span>WHT 15%</span><span className="font-medium w-28 text-right">+ {fmt(whtAmount)}</span></div>}
                  <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5"><span className="font-semibold text-zinc-700">Grand Total</span><span className="font-bold text-zinc-900 w-28 text-right">{fmt(grandTotal)}</span></div>
                  {form.depositPercent != null && (
                    <>
                      <div className="flex gap-8 text-green-700"><span>Deposit ({form.depositPercent}%)</span><span className="font-medium w-28 text-right">− {fmt(depositAmount)}</span></div>
                      <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5"><span className="font-semibold text-zinc-700">Balance Due</span><span className="font-bold text-zinc-900 w-28 text-right">{fmt(balanceDue)}</span></div>
                    </>
                  )}
                </div>
              </div>
              {/* WHT toggle */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Withholding Tax (WHT)</p>
                  <p className="text-xs text-amber-600 mt-0.5">Client pays net + 15% WHT on top. You receive the full net — client remits WHT to Revenue Department.</p>
                </div>
                <button onClick={() => setField('wht', !form.wht)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.wht ? 'bg-amber-500' : 'bg-zinc-300'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.wht ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {/* Deposit toggle */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Deposit / Partial Payment</p>
                  <p className="text-xs text-green-600 mt-0.5">Require a deposit upfront; client pays the balance on delivery.</p>
                  {form.depositPercent != null && (
                    <div className="flex items-center gap-2 mt-3">
                      <input type="number" min={1} max={99} value={form.depositPercent} onChange={(e) => setField('depositPercent', Math.min(99, Math.max(1, parseInt(e.target.value) || 50)))} className="w-16 h-8 rounded-md border border-green-300 px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white text-center" />
                      <span className="text-sm text-green-700">% deposit = {fmt(depositAmount)}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setField('depositPercent', form.depositPercent != null ? undefined : 50)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.depositPercent != null ? 'bg-green-500' : 'bg-zinc-300'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.depositPercent != null ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {/* Notes */}
              <PanelField label="Notes">
                <textarea rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} className={`${inputCls} h-auto py-2 resize-none`} placeholder="Payment terms, additional instructions…" />
              </PanelField>
            </div>
            <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between shrink-0">
              {formError ? <p className="text-sm text-red-600">{formError}</p> : <span />}
              <div className="flex gap-3">
                <button onClick={closePanel} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
                <button onClick={handleSave} className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
                  {editingId ? 'Save changes' : 'Create invoice'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Status change confirm ─────────────────────────────────────────────── */}
      {statusChange && (() => {
        const { from, to } = statusChange
        const hint =
          from === 'sent'    && to === 'partial' ? { title: 'Accept Deposit',          desc: 'Confirm that the client has paid the deposit. The invoice will move to "Deposit Rcvd" and you can collect the remaining balance later.' }
        : from === 'partial' && to === 'paid'    ? { title: 'Final Payment Received',  desc: 'Confirm that the client has paid the remaining balance. The invoice will be marked as fully Paid.' }
        : from === 'sent'    && to === 'paid'    ? { title: 'Mark as Paid',            desc: 'Confirm that the client has paid the full amount. The invoice will be marked as Paid — no deposit was required.' }
        : null
        return (
          <ModalShell onClose={() => setStatusChange(null)} maxWidth="max-w-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">{hint?.title ?? 'Change status?'}</h2>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[from].cls}`}>{STATUS_CONFIG[from].label}</span>
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[to].cls}`}>{STATUS_CONFIG[to].label}</span>
              </div>
              {hint && <p className="text-sm text-zinc-500 mb-5">{hint.desc}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setStatusChange(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
                <button onClick={confirmStatusChange} className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition">Confirm</button>
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {deleteId && (
        <ModalShell onClose={() => setDeleteId(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Delete invoice?</h2>
            <p className="text-sm text-zinc-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Create project from invoice ───────────────────────────────────────── */}
      {createProjectInvId && (() => {
        const inv    = invoices.find((i) => i.id === createProjectInvId)
        const client = inv ? clients.find((c) => c.id === inv.clientId) : null
        return (
          <ModalShell onClose={() => setCreateProjectInvId(null)}>
            <div className="flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Create project</h2>
                  {inv && <p className="text-xs text-zinc-400 mt-0.5">from {inv.number} · {client?.name ?? '—'}</p>}
                </div>
                <button onClick={() => setCreateProjectInvId(null)} className="text-zinc-400 hover:text-zinc-700 transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Project Name</label>
                  <input type="text" value={cpName} onChange={(e) => setCpName(e.target.value)} placeholder={client?.name ?? 'Project name…'} className={inputCls} />
                  {client && !cpName && (
                    <button onClick={() => setCpName(client.name)} className="self-start text-xs text-brand hover:underline">Use &quot;{client.name}&quot;</button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Scope items</label>
                  <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-3 max-h-52 overflow-y-auto">
                    {cpItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={!cpExcluded.has(item.id)} onChange={() => { setCpExcluded((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next }) }} className="rounded border-zinc-300 text-brand focus:ring-brand" />
                        <span className={`text-sm ${cpExcluded.has(item.id) ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{item.description}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400">Uncheck items to exclude them.</p>
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-zinc-100 justify-end shrink-0">
                <button onClick={() => setCreateProjectInvId(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
                <button
                  onClick={() => {
                    if (!inv) return
                    const name = cpName.trim() || (client?.name ?? 'New Project')
                    setProjects([...projects, { id: uid(), name, clientId: inv.clientId, invoiceIds: [inv.id], items: cpItems.filter((it) => !cpExcluded.has(it.id)).map((it) => ({ ...it, status: 'todo' as ProjectItemStatus })), status: 'active', createdAt: new Date().toISOString() }])
                    setCreateProjectInvId(null); setCpName(''); setCpItems([]); setCpExcluded(new Set())
                  }}
                  className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
                >
                  Create project
                </button>
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* ── View project progress ─────────────────────────────────────────────── */}
      {viewProjectId && (() => {
        const project    = projects.find((p) => p.id === viewProjectId)
        if (!project) return null
        const doneCount  = project.items.filter((it) => it.status === 'done').length
        const totalItems = project.items.length
        const pct        = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0
        const statusCls  = { active: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', 'on-hold': 'bg-zinc-100 text-zinc-600' }
        const statusLbl  = { active: 'Active', completed: 'Completed', 'on-hold': 'On Hold' }
        return (
          <ModalShell onClose={() => setViewProjectId(null)}>
            <div className="flex flex-col max-h-[85vh]">
              <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{project.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCls[project.status]}`}>{statusLbl[project.status]}</span>
                    {totalItems > 0 && <span className="text-xs text-zinc-400">{doneCount}/{totalItems} done · {pct}%</span>}
                  </div>
                </div>
                <button onClick={() => setViewProjectId(null)} className="text-zinc-400 hover:text-zinc-700 transition shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {totalItems > 0 && (
                <div className="px-6 pt-4 shrink-0">
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
                {project.items.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">No scope items in this project.</p>
                ) : (
                  project.items.map((item) => {
                    const cfg = ITEM_STATUS_CONFIG[item.status]
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 transition">
                        <button
                          onClick={() => setProjects(projects.map((p) => p.id !== project.id ? p : { ...p, items: p.items.map((it) => it.id !== item.id ? it : { ...it, status: ITEM_STATUS_NEXT[it.status] }) }))}
                          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition hover:opacity-80 ${cfg.cls}`}
                          title="Click to cycle status"
                        >
                          {cfg.label}
                        </button>
                        <span className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{item.description}</span>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="px-6 py-3 border-t border-zinc-100 shrink-0">
                <p className="text-xs text-zinc-400">Click a status badge to cycle: To Do → In Progress → Done</p>
              </div>
            </div>
          </ModalShell>
        )
      })()}
    </>
  )
}

function PanelField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}
