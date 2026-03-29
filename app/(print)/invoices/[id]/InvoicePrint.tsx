'use client'

import { useEffect, useState } from 'react'
import type { Invoice, Client, CompanyProfile, PaymentInfo } from '@/app/dashboard/AppStore'
import { loadCompanyProfile, loadPaymentInfo } from '@/app/dashboard/AppStore'

const WHT_RATE = 0.15

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface PrintData {
  invoice: Invoice
  client: Client | null
  company: CompanyProfile
  payment: PaymentInfo
}

export default function InvoicePrint({ id }: { id: string }) {
  const [data, setData] = useState<PrintData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    try {
      const invoices: Invoice[] = JSON.parse(localStorage.getItem('app_invoices') ?? '[]')
      const clients: Client[] = JSON.parse(localStorage.getItem('app_clients') ?? '[]')
      const inv = invoices.find((i) => i.id === id)
      if (!inv) { setNotFound(true); return }
      setData({
        invoice: inv,
        client: clients.find((c) => c.id === inv.clientId) ?? null,
        company: loadCompanyProfile(),
        payment: loadPaymentInfo(),
      })
    } catch {
      setNotFound(true)
    }
  }, [id])

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Invoice not found.</div>
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">Loading…</div>
  }

  const { invoice, client, company, payment } = data
  const subtotal = invoice.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
  const whtAmount = subtotal * WHT_RATE
  const grandTotal = invoice.wht ? subtotal + whtAmount : subtotal

  return (
    <>
      {/* Screen toolbar */}
      <div className="no-print fixed top-0 inset-x-0 z-10 flex items-center justify-between px-6 py-3 bg-zinc-800 text-white text-sm">
        <span className="font-medium">{invoice.number}</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 h-8 px-4 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Save as PDF / Print
        </button>
      </div>

      {/* Screen preview */}
      <div className="no-print pt-14 min-h-screen bg-zinc-300 flex justify-center py-10 px-4">
        <Sheet invoice={invoice} client={client} company={company} payment={payment} subtotal={subtotal} whtAmount={whtAmount} grandTotal={grandTotal} />
      </div>

      {/* Print-only output */}
      <div className="print-only">
        <Sheet invoice={invoice} client={client} company={company} payment={payment} subtotal={subtotal} whtAmount={whtAmount} grandTotal={grandTotal} />
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; background: white; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </>
  )
}

function Sheet({
  invoice, client, company, payment, subtotal, whtAmount, grandTotal,
}: {
  invoice: Invoice
  client: Client | null
  company: CompanyProfile
  payment: PaymentInfo
  subtotal: number
  whtAmount: number
  grandTotal: number
}) {
  const hasPaymentInfo = payment.accountName || payment.accountNumber || payment.abaSwift || payment.qrImage

  return (
    <div
      className="bg-white w-[210mm] min-h-[297mm] p-[14mm] flex flex-col"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.6', color: '#18181b' }}
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-7">
        {/* Company info */}
        <div className="flex flex-col gap-1">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt="Logo" style={{ height: '48px', maxWidth: '160px', objectFit: 'contain', marginBottom: '6px' }} />
          ) : (
            <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{company.name || 'Your Company'}</p>
          )}
          {company.logo && company.name && <p style={{ fontWeight: 600 }}>{company.name}</p>}
          {company.address && <p style={{ color: '#52525b', whiteSpace: 'pre-wrap' }}>{company.address}</p>}
          {company.phone && <p style={{ color: '#52525b' }}>{company.phone}</p>}
          {company.website && <p style={{ color: '#52525b' }}>{company.website}</p>}
        </div>

        {/* Invoice meta */}
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>INVOICE</p>
          <table style={{ marginLeft: 'auto', fontSize: '11px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ paddingRight: '16px', color: '#71717a', paddingBottom: '2px' }}>Invoice No.</td>
                <td style={{ fontWeight: 700 }}>{invoice.number}</td>
              </tr>
              <tr>
                <td style={{ paddingRight: '16px', color: '#71717a', paddingBottom: '2px' }}>Date</td>
                <td style={{ fontWeight: 600 }}>{invoice.date}</td>
              </tr>
              <tr>
                <td style={{ paddingRight: '16px', color: '#71717a', paddingBottom: '2px' }}>Payment Terms</td>
                <td style={{ fontWeight: 600 }}>{invoice.paymentTerms ?? 'Due on receipt'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '2px solid #18181b', marginBottom: '20px' }} />

      {/* ── Bill To ── */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '9px', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Bill To</p>
        {client ? (
          <>
            <p style={{ fontWeight: 700, fontSize: '13px' }}>{client.name}</p>
            {client.email && <p style={{ color: '#52525b' }}>{client.email}</p>}
            {client.phone && <p style={{ color: '#52525b' }}>{client.phone}</p>}
            {client.address && <p style={{ color: '#52525b', whiteSpace: 'pre-wrap' }}>{client.address}</p>}
          </>
        ) : (
          <p style={{ color: '#a1a1aa', fontStyle: 'italic' }}>Client not found</p>
        )}
      </div>

      {/* ── Line items ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11px' }}>
        <thead>
          <tr style={{ backgroundColor: '#18181b', color: 'white' }}>
            <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Description / Scope of Work</th>
            <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: 600, width: '60px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600, width: '90px' }}>Unit Price</th>
            <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600, width: '90px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={item.id} style={{ backgroundColor: i % 2 === 1 ? '#fafafa' : 'white' }}>
              <td style={{ padding: '6px 10px', color: '#27272a' }}>{item.description}</td>
              <td style={{ padding: '6px 10px', textAlign: 'center', color: '#3f3f46' }}>{item.qty}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', color: '#3f3f46' }}>${fmt(item.unitPrice)}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>${fmt(item.qty * item.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <div style={{ width: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e4e4e7', color: '#52525b' }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 600, color: '#18181b' }}>${fmt(subtotal)}</span>
          </div>
          {invoice.wht && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e4e4e7', color: '#92400e' }}>
              <span>Withholding Tax (15%)</span>
              <span style={{ fontWeight: 600 }}>+ ${fmt(whtAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '2px solid #18181b', marginTop: '2px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px' }}>Grand Total</span>
            <span style={{ fontWeight: 800, fontSize: '13px' }}>${fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── WHT notice ── */}
      {invoice.wht && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', color: '#92400e', fontSize: '10px' }}>
          <p style={{ fontWeight: 700, marginBottom: '3px' }}>Withholding Tax Notice</p>
          <p>
            Net amount payable to us: <strong>${fmt(subtotal)}</strong>.
            WHT of <strong>${fmt(whtAmount)}</strong> (15%) is to be remitted to the Revenue Department by the client.
            Total amount payable by client: <strong>${fmt(grandTotal)}</strong>.
          </p>
        </div>
      )}

      {/* ── Notes ── */}
      {invoice.notes && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '9px', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Notes</p>
          <p style={{ color: '#52525b', whiteSpace: 'pre-wrap', fontSize: '10px' }}>{invoice.notes}</p>
        </div>
      )}

      {/* ── Payment Info ── */}
      {hasPaymentInfo && (
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e4e4e7' }}>
          <p style={{ fontSize: '9px', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Payment Information</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            {/* Bank details */}
            <div style={{ flex: 1 }}>
              {payment.accountName && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: '#71717a', minWidth: '110px' }}>Account Name</span>
                  <span style={{ fontWeight: 600 }}>{payment.accountName}</span>
                </div>
              )}
              {payment.accountNumber && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: '#71717a', minWidth: '110px' }}>Account Number</span>
                  <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>{payment.accountNumber}</span>
                </div>
              )}
              {payment.abaSwift && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: '#71717a', minWidth: '110px' }}>ABA / SWIFT</span>
                  <span style={{ fontWeight: 600 }}>{payment.abaSwift}</span>
                </div>
              )}
            </div>

            {/* QR code */}
            {payment.qrImage && (
              <div style={{ textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payment.qrImage} alt="Payment QR" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                <p style={{ fontSize: '9px', color: '#71717a', marginTop: '3px' }}>Scan to pay</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      {!hasPaymentInfo && (
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e4e4e7', textAlign: 'center', color: '#a1a1aa', fontSize: '10px' }}>
          Thank you for your business.
        </div>
      )}
    </div>
  )
}
