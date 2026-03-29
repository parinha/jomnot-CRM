'use client'

import { useState } from 'react'
import { useStore, type Invoice, type LineItem, type InvoiceStatus } from '../AppStore'

const WHT_RATE = 0.15

const PAYMENT_TERMS = ['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60']

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:   { label: 'Draft',   cls: 'bg-zinc-100 text-zinc-600' },
  sent:    { label: 'Sent',    cls: 'bg-blue-100 text-blue-700' },
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-600' },
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function nextInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear()
  const count = invoices.filter((inv) => inv.number.startsWith(`INV-${year}`)).length
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`
}

function emptyItem(): LineItem {
  return { id: uid(), description: '', qty: 1, unitPrice: 0 }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type FormState = Omit<Invoice, 'id'>

export default function InvoicesView() {
  const { clients, invoices, setInvoices } = useStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const blankForm = (): FormState => ({
    number: nextInvoiceNumber(invoices),
    date: new Date().toISOString().slice(0, 10),
    paymentTerms: 'Due on receipt',
    status: 'draft',
    clientId: '',
    items: [emptyItem()],
    wht: false,
    notes: '',
  })

  const [form, setForm] = useState<FormState>(blankForm)

  function openNew() {
    setEditingId(null)
    setForm(blankForm())
    setFormError('')
    setPanelOpen(true)
  }

  function openEdit(inv: Invoice) {
    setEditingId(inv.id)
    setForm({
      number: inv.number,
      date: inv.date,
      paymentTerms: inv.paymentTerms ?? 'Due on receipt',
      status: inv.status ?? 'draft',
      clientId: inv.clientId,
      items: inv.items,
      wht: inv.wht,
      notes: inv.notes,
    })
    setFormError('')
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setEditingId(null)
    setFormError('')
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addItem() { setField('items', [...form.items, emptyItem()]) }

  function removeItem(id: string) {
    if (form.items.length === 1) return
    setField('items', form.items.filter((it) => it.id !== id))
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setField('items', form.items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function handleSave() {
    if (!form.clientId) { setFormError('Please select a client.'); return }
    if (!form.number.trim()) { setFormError('Invoice number is required.'); return }
    if (form.items.some((it) => !it.description.trim())) {
      setFormError('All line items need a description.'); return
    }
    if (editingId) {
      setInvoices(invoices.map((inv) => (inv.id === editingId ? { id: editingId, ...form } : inv)))
    } else {
      setInvoices([...invoices, { id: uid(), ...form }])
    }
    closePanel()
  }

  function handleDelete(id: string) {
    setInvoices(invoices.filter((inv) => inv.id !== id))
    setDeleteId(null)
  }

  function updateStatus(id: string, status: InvoiceStatus) {
    setInvoices(invoices.map((inv) => (inv.id === id ? { ...inv, status } : inv)))
  }

  const subtotal = form.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
  const whtAmount = subtotal * WHT_RATE
  const grandTotal = form.wht ? subtotal + whtAmount : subtotal

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{invoices.length} total</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New invoice
        </button>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <svg className="w-10 h-10 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No invoices yet. Create your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Client</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Terms</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Grand Total</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500">WHT</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const client = clients.find((c) => c.id === inv.clientId)
                const sub = inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
                const gt = inv.wht ? sub * 1.15 : sub
                const status: InvoiceStatus = inv.status ?? 'draft'
                const sc = STATUS_CONFIG[status]
                return (
                  <tr key={inv.id} className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{inv.number}</td>
                    <td className="px-4 py-3 text-zinc-600">{client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{inv.date}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{inv.paymentTerms ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">${fmt(gt)}</td>
                    <td className="px-4 py-3 text-center">
                      {inv.wht && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">15%</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={status}
                        onChange={(e) => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 ${sc.cls}`}
                      >
                        {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/invoices/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition"
                        >
                          PDF
                        </a>
                        <button
                          onClick={() => openEdit(inv)}
                          className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(inv.id)}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                        >
                          Delete
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

      {/* Slide-in panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">{editingId ? 'Edit invoice' : 'New invoice'}</h2>
              <button onClick={closePanel} className="text-zinc-400 hover:text-zinc-700 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

              {/* Number + Date */}
              <div className="grid grid-cols-2 gap-4">
                <PanelField label="Invoice Number" required>
                  <input value={form.number} onChange={(e) => setField('number', e.target.value)} className={inputCls} placeholder="INV-2025-001" />
                </PanelField>
                <PanelField label="Date" required>
                  <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className={inputCls} />
                </PanelField>
              </div>

              {/* Client + Status */}
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

              {/* Status */}
              <PanelField label="Status">
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => {
                    const active = form.status === s
                    const sc = STATUS_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => setField('status', s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? `${sc.cls} border-current` : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                      >
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
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  {form.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-px bg-zinc-200">
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="Scope of work…"
                        className="bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-zinc-50"
                      />
                      <input
                        type="number" min={0}
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })}
                        className="bg-white px-3 py-2 text-sm text-center text-zinc-900 focus:outline-none focus:bg-zinc-50"
                      />
                      <input
                        type="number" min={0}
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className="bg-white px-3 py-2 text-sm text-right text-zinc-900 focus:outline-none focus:bg-zinc-50"
                      />
                      <div className="bg-white px-3 py-2 text-sm text-right text-zinc-700 font-medium">
                        {fmt(item.qty * item.unitPrice)}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={form.items.length === 1}
                        className="bg-white flex items-center justify-center text-zinc-300 hover:text-red-500 disabled:opacity-0 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-3 flex flex-col items-end gap-1.5 text-sm">
                  <div className="flex gap-8">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="font-medium text-zinc-900 w-28 text-right">${fmt(subtotal)}</span>
                  </div>
                  {form.wht && (
                    <div className="flex gap-8 text-amber-700">
                      <span>WHT 15%</span>
                      <span className="font-medium w-28 text-right">+ ${fmt(whtAmount)}</span>
                    </div>
                  )}
                  <div className="flex gap-8 pt-1.5 border-t border-zinc-200 mt-0.5">
                    <span className="font-semibold text-zinc-700">Grand Total</span>
                    <span className="font-bold text-zinc-900 w-28 text-right">${fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* WHT toggle */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Withholding Tax (WHT)</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Client pays net + 15% WHT on top. You receive the full net — client remits WHT to Revenue Department.
                  </p>
                </div>
                <button
                  onClick={() => setField('wht', !form.wht)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.wht ? 'bg-amber-500' : 'bg-zinc-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.wht ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Notes */}
              <PanelField label="Notes">
                <textarea
                  rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)}
                  className={`${inputCls} h-auto py-2 resize-none`}
                  placeholder="Payment terms, additional instructions…"
                />
              </PanelField>

            </div>

            <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between shrink-0">
              {formError ? <p className="text-sm text-red-600">{formError}</p> : <span />}
              <div className="flex gap-3">
                <button onClick={closePanel} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
                <button onClick={handleSave} className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition">
                  {editingId ? 'Save changes' : 'Create invoice'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Delete invoice?</h2>
            <p className="text-sm text-zinc-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PanelField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition w-full bg-white'
