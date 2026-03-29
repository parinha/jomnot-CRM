'use client'

import { useState } from 'react'
import { useStore, type Client } from '../AppStore'

const EMPTY_FORM: Omit<Client, 'id'> = { name: '', phone: '', address: '', email: '' }

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function ClientsView() {
  const { clients, setClients, invoices } = useStore()

  function clientStats(clientId: string) {
    const clientInvoices = invoices.filter((inv) => inv.clientId === clientId)
    const earned = clientInvoices.reduce(
      (sum, inv) => sum + inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0),
      0
    )
    return { count: clientInvoices.length, earned }
  }

  function fmtUSD(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  function openAdd() {
    setEditingClient(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setForm({ name: client.name, phone: client.phone, address: client.address, email: client.email })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingClient(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.')
      return
    }
    if (editingClient) {
      setClients(clients.map((c) => (c.id === editingClient.id ? { ...editingClient, ...form } : c)))
    } else {
      setClients([...clients, { id: generateId(), ...form }])
    }
    closeModal()
  }

  function handleDelete(id: string) {
    setClients(clients.filter((c) => c.id !== id))
    setDeleteId(null)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Clients</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{clients.length} total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <svg className="w-10 h-10 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">No clients yet. Add your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 hidden lg:table-cell">Address</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 hidden sm:table-cell">Invoices</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Earned</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client, i) => (
                <tr
                  key={client.id}
                  className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition ${i % 2 === 1 ? 'bg-zinc-50/40' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900">{client.name}</td>
                  <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{client.email}</td>
                  <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">{client.phone || '—'}</td>
                  <td className="px-4 py-3 text-zinc-600 max-w-xs truncate hidden lg:table-cell">{client.address || '—'}</td>
                  <ClientStatsCells clientId={client.id} invoices={invoices} fmtUSD={fmtUSD} />
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(client)}
                        className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(client.id)}
                        className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-5">
              {editingClient ? 'Edit client' : 'Add client'}
            </h2>
            <div className="flex flex-col gap-4">
              <Field label="Name *" id="name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Jane Doe" />
              <Field label="Email *" id="email" type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="jane@example.com" />
              <Field label="Phone" id="phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="+1 555 000 0000" />
              <Field label="Address" id="address" value={form.address} onChange={(v) => setForm((p) => ({ ...p, address: v }))} placeholder="123 Main St, City" />
            </div>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={closeModal} className="h-9 px-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 transition">Cancel</button>
              <button onClick={handleSave} className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
                {editingClient ? 'Save changes' : 'Add client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">Delete client?</h2>
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

import type { Invoice } from '../AppStore'

function ClientStatsCells({ clientId, invoices, fmtUSD }: { clientId: string; invoices: Invoice[]; fmtUSD: (n: number) => string }) {
  const clientInvoices = invoices.filter((inv) => inv.clientId === clientId)
  const count = clientInvoices.length
  const earned = clientInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0), 0)
  return (
    <>
      <td className="px-4 py-3 text-center hidden sm:table-cell">
        {count > 0
          ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">{count}</span>
          : <span className="text-zinc-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-right font-medium text-zinc-900">
        {count > 0 ? fmtUSD(earned) : <span className="text-zinc-300 text-xs">—</span>}
      </td>
    </>
  )
}

function Field({ label, id, value, onChange, placeholder, type = 'text' }: {
  label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
      />
    </div>
  )
}
