'use client'

import { useState } from 'react'
import { useStore, type Invoice, type Client, type InvoiceStatus } from '../AppStore'
import { calcSubtotal, calcEarned, calcBalance } from '@/app/_services/invoiceService'
import { fmtUSD } from '@/app/_lib/formatters'
import { STATUS_CONFIG } from '@/app/_config/statusConfig'
import ModalShell from '@/app/_components/ModalShell'
import InvoicePreviewModal from '@/app/_components/InvoicePreviewModal'

const fmt = fmtUSD

// ── Payment action buttons ────────────────────────────────────────────────────

function PaymentActions({ inv, onAction }: { inv: Invoice; onAction: (id: string, from: InvoiceStatus, to: InvoiceStatus) => void }) {
  const status = inv.status ?? 'draft'
  if (status === 'draft') {
    return (
      <button
        onClick={() => onAction(inv.id, 'draft', 'sent')}
        className="h-7 px-3 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition whitespace-nowrap"
      >
        Mark as sent
      </button>
    )
  }
  if (status === 'sent' && inv.depositPercent != null) {
    return (
      <button
        onClick={() => onAction(inv.id, 'sent', 'partial')}
        className="h-7 px-3 rounded-md bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 transition whitespace-nowrap"
      >
        Accept deposit
      </button>
    )
  }
  if (status === 'partial') {
    return (
      <button
        onClick={() => onAction(inv.id, 'partial', 'paid')}
        className="h-7 px-3 rounded-md bg-green-100 text-green-800 text-xs font-medium hover:bg-green-200 transition whitespace-nowrap"
      >
        Final payment
      </button>
    )
  }
  if (status === 'sent' && inv.depositPercent == null) {
    return (
      <button
        onClick={() => onAction(inv.id, 'sent', 'paid')}
        className="h-7 px-3 rounded-md bg-green-100 text-green-800 text-xs font-medium hover:bg-green-200 transition whitespace-nowrap"
      >
        Mark paid
      </button>
    )
  }
  if (status === 'overdue') {
    return (
      <button
        onClick={() => onAction(inv.id, 'overdue', 'paid')}
        className="h-7 px-3 rounded-md bg-green-100 text-green-800 text-xs font-medium hover:bg-green-200 transition whitespace-nowrap"
      >
        Mark paid
      </button>
    )
  }
  return null
}

// ── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({ inv, clients, showReceived, showBalance, onAction, onPreview }: {
  inv: Invoice
  clients: Client[]
  showReceived?: boolean
  showBalance?: boolean
  onAction: (id: string, from: InvoiceStatus, to: InvoiceStatus) => void
  onPreview: (id: string) => void
}) {
  const client      = clients.find((c) => c.id === inv.clientId)
  const sub        = calcSubtotal(inv)
  const invDeposit = inv.depositPercent != null ? sub * (inv.depositPercent / 100) : null
  const invBalance = invDeposit != null ? sub - invDeposit : null
  const received    = calcEarned(inv)
  const balance     = calcBalance(inv)
  const sc          = STATUS_CONFIG[inv.status ?? 'draft']

  return (
    <tr className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition text-sm">
      <td className="px-4 py-3 whitespace-nowrap">
        <button onClick={() => onPreview(inv.id)} className="font-medium text-zinc-900 hover:text-brand hover:underline transition text-left">
          {inv.number}
        </button>
      </td>
      <td className="px-4 py-3 text-zinc-600 truncate max-w-[160px]">{client?.name ?? '—'}</td>
      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap hidden sm:table-cell">{inv.date}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="font-medium text-zinc-900">{fmt(sub)}</span>
        {invBalance != null && (
          <div className="flex flex-col items-end gap-0.5 mt-0.5">
            <span className="text-xs text-zinc-400">{fmt(invDeposit!)} dep · {fmt(invBalance)} bal</span>
          </div>
        )}
      </td>
      {showReceived && (
        <td className="px-4 py-3 text-right font-semibold text-green-700 whitespace-nowrap">{fmt(received)}</td>
      )}
      {showBalance && (
        <td className="px-4 py-3 text-right font-semibold text-amber-700 whitespace-nowrap">{fmt(balance)}</td>
      )}
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <PaymentActions inv={inv} onAction={onAction} />
      </td>
    </tr>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, count, accent, children }: { title: string; count: number; accent?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className={`text-sm font-semibold ${accent ?? 'text-zinc-700'}`}>{title}</span>
        <span className="text-xs text-zinc-400">{count} invoice{count !== 1 ? 's' : ''}</span>
      </div>
      {children}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PaymentsView() {
  const { clients, invoices, setInvoices } = useStore()

  const [statusChange, setStatusChange] = useState<{ id: string; from: InvoiceStatus; to: InvoiceStatus } | null>(null)
  const [previewInvId, setPreviewInvId] = useState<string | null>(null)

  function handleAction(id: string, from: InvoiceStatus, to: InvoiceStatus) {
    setStatusChange({ id, from, to })
  }

  function confirmChange() {
    if (!statusChange) return
    setInvoices(invoices.map((inv) => inv.id === statusChange.id ? { ...inv, status: statusChange.to } : inv))
    setStatusChange(null)
  }

  // Group
  const paid    = invoices.filter((inv) => inv.status === 'paid')
  const partial = invoices.filter((inv) => inv.status === 'partial')
  const unpaid  = invoices.filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
  const draft   = invoices.filter((inv) => inv.status === 'draft')

  // Totals
  const totalReceived        = invoices.reduce((s, inv) => s + calcEarned(inv), 0)
  const awaitingFinalTotal   = partial.reduce((s, inv) => s + calcBalance(inv), 0)
  const depositReceivedTotal = partial.reduce((s, inv) => s + calcEarned(inv), 0)
  const outstandingTotal     = unpaid.reduce((s, inv) => s + calcBalance(inv), 0)

  const RIGHT_COLS = new Set(['Total', 'Deposit rcvd', 'Balance due', 'Received'])
  const HIDDEN_SM  = new Set(['Client', 'Date'])

  const tableHead = (cols: string[]) => (
    <thead>
      <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
        {cols.map((h, i) => (
          <th
            key={`${h}-${i}`}
            className={[
              'px-4 py-2.5',
              RIGHT_COLS.has(h) ? 'text-right' : 'text-left',
              HIDDEN_SM.has(h) ? 'hidden sm:table-cell' : '',
            ].join(' ').trim()}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Payments</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Track received, pending, and outstanding payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-medium text-zinc-500 mb-1">Total received</p>
          <p className="text-xl font-bold text-green-700">{fmt(totalReceived)}</p>
          <p className="text-xs text-zinc-400 mt-1">{paid.length} paid · {partial.length} deposit held</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-medium text-zinc-500 mb-1">Awaiting final payment</p>
          <p className="text-xl font-bold text-amber-600">{fmt(awaitingFinalTotal)}</p>
          <p className="text-xs text-zinc-400 mt-1">{partial.length} invoice{partial.length !== 1 ? 's' : ''} · {fmt(depositReceivedTotal)} deposit held</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-medium text-zinc-500 mb-1">Outstanding</p>
          <p className={`text-xl font-bold ${unpaid.some(i => i.status === 'overdue') ? 'text-red-600' : 'text-zinc-700'}`}>{fmt(outstandingTotal)}</p>
          <p className="text-xs text-zinc-400 mt-1">
            {unpaid.filter(i => i.status === 'sent').length} sent · {unpaid.filter(i => i.status === 'overdue').length} overdue
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-medium text-zinc-500 mb-1">Draft</p>
          <p className="text-xl font-bold text-zinc-400">{draft.length}</p>
          <p className="text-xs text-zinc-400 mt-1">not yet sent</p>
        </div>
      </div>

      {/* Awaiting final payment — shown first so action is prominent */}
      {partial.length > 0 && (
        <Section title="Awaiting final payment" count={partial.length} accent="text-amber-600">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Deposit rcvd', 'Balance due', 'Status', ''])}
              <tbody>
                {partial.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} clients={clients} showReceived showBalance onAction={handleAction} onPreview={setPreviewInvId} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Outstanding */}
      {unpaid.length > 0 && (
        <Section title="Outstanding" count={unpaid.length} accent={unpaid.some(i => i.status === 'overdue') ? 'text-red-600' : 'text-blue-600'}>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Status', ''])}
              <tbody>
                {unpaid.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} clients={clients} onAction={handleAction} onPreview={setPreviewInvId} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Fully paid */}
      {paid.length > 0 && (
        <Section title="Fully paid" count={paid.length} accent="text-green-700">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Received', 'Status', ''])}
              <tbody>
                {paid.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} clients={clients} showReceived onAction={handleAction} onPreview={setPreviewInvId} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Draft */}
      {draft.length > 0 && (
        <Section title="Draft" count={draft.length} accent="text-zinc-400">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead(['Invoice', 'Client', 'Date', 'Total', 'Status', ''])}
              <tbody>
                {draft.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} clients={clients} onAction={handleAction} onPreview={setPreviewInvId} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <p className="text-sm">No invoices yet.</p>
        </div>
      )}

      {/* ── Invoice preview ─────────────────────────────────────────────────────── */}
      {previewInvId && <InvoicePreviewModal invId={previewInvId} onClose={() => setPreviewInvId(null)} />}

      {/* ── Status change confirm ───────────────────────────────────────────────── */}
      {statusChange && (() => {
        const { from, to } = statusChange
        const hint =
          from === 'sent'    && to === 'partial' ? { title: 'Accept deposit',         desc: 'Confirm the client has paid the deposit. Invoice moves to "Deposit Rcvd" — collect the balance later.' }
        : from === 'partial' && to === 'paid'    ? { title: 'Final payment received', desc: 'Confirm the client has paid the remaining balance. Invoice will be marked as fully Paid.' }
        : (from === 'sent' || from === 'overdue') && to === 'paid' ? { title: 'Mark as paid', desc: 'Confirm the client has paid the full amount.' }
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
                <button onClick={confirmChange} className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition">Confirm</button>
              </div>
            </div>
          </ModalShell>
        )
      })()}
    </div>
  )
}
