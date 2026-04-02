'use client';

import { useEffect, useState } from 'react';
import type { Invoice, Client, CompanyProfile, PaymentInfo } from '@/app/dashboard/AppStore';
import { fmtUSD as fmt } from '@/app/_lib/formatters';
import { getInvoices, WHT_RATE } from '@/app/_services/invoiceService';
import { getClients } from '@/app/_services/clientService';
import { getCompanyProfile, getPaymentInfo } from '@/app/_services/settingsService';

// ── Design tokens ──────────────────────────────────────────────────────────────
const DARK = '#1a1a1a';
const MUTED = '#71717a';
const LIGHT = '#e4e4e7';
const BRAND = '#FFC206';

interface PrintData {
  invoice: Invoice;
  client: Client | null;
  company: CompanyProfile;
  payment: PaymentInfo;
}

export default function InvoicePrint({ id }: { id: string }) {
  const [data, setData] = useState<PrintData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [invoices, clients, company, payment] = await Promise.all([
          getInvoices(),
          getClients(),
          getCompanyProfile(),
          getPaymentInfo(),
        ]);
        const inv = invoices.find((i) => i.id === id);
        if (!inv) {
          setNotFound(true);
          return;
        }
        setData({
          invoice: inv,
          client: clients.find((c) => c.id === inv.clientId) ?? null,
          company,
          payment,
        });
      } catch {
        setNotFound(true);
      }
    }
    load();
  }, [id]);

  if (notFound)
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        Invoice not found.
      </div>
    );
  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        Loading…
      </div>
    );

  const { invoice, client, company, payment } = data;
  const subtotal = invoice.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const whtAmount = invoice.withWHT ? subtotal * WHT_RATE : null;
  const netTotal = invoice.withWHT ? subtotal * (1 - WHT_RATE) : subtotal;
  const depositAmount =
    invoice.depositPercent != null ? netTotal * (invoice.depositPercent / 100) : null;
  const balanceDue = depositAmount != null ? netTotal - depositAmount : null;

  return (
    <>
      {/* Screen toolbar */}
      <div className="no-print fixed top-0 inset-x-0 z-10 flex items-center justify-between px-6 py-3 bg-zinc-800 text-white text-sm">
        <span className="font-medium">{invoice.number}</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 h-8 px-4 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100 transition"
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
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Save as PDF / Print
        </button>
      </div>

      {/* Screen preview */}
      <div className="no-print pt-14 min-h-screen bg-zinc-200 flex justify-center py-10 px-4">
        <Sheet
          invoice={invoice}
          client={client}
          company={company}
          payment={payment}
          subtotal={subtotal}
          whtAmount={whtAmount}
          netTotal={netTotal}
          depositAmount={depositAmount}
          balanceDue={balanceDue}
        />
      </div>

      {/* Print output */}
      <div className="print-only">
        <Sheet
          invoice={invoice}
          client={client}
          company={company}
          payment={payment}
          subtotal={subtotal}
          whtAmount={whtAmount}
          netTotal={netTotal}
          depositAmount={depositAmount}
          balanceDue={balanceDue}
        />
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; background: white; }
          .no-print   { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────────

function Sheet({
  invoice,
  client,
  company,
  payment,
  subtotal,
  whtAmount,
  netTotal,
  depositAmount,
  balanceDue,
}: {
  invoice: Invoice;
  client: Client | null;
  company: CompanyProfile;
  payment: PaymentInfo;
  subtotal: number;
  whtAmount: number | null;
  netTotal: number;
  depositAmount: number | null;
  balanceDue: number | null;
}) {
  const projectLabel = invoice.projectName || (client ? `${client.name} Campaign` : '');
  const hasPayment =
    payment.bankName || payment.accountName || payment.accountNumber || payment.swiftCode;

  return (
    <div
      className="bg-white w-[210mm]"
      style={{
        minHeight: '297mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11px',
        lineHeight: '1.6',
        color: DARK,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* DRAFT watermark */}
      {invoice.status === 'draft' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: '88px',
              fontWeight: 900,
              color: 'rgba(0,0,0,0.05)',
              textTransform: 'uppercase',
              transform: 'rotate(-30deg)',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            DRAFT
          </span>
        </div>
      )}

      {/* ── Content wrapper ── */}
      <div style={{ padding: '14mm 14mm 10mm', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ═══ HEADER ═══ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}
        >
          {/* Left — Logo + company profile */}
          <div style={{ maxWidth: '55%' }}>
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo}
                alt="Logo"
                style={{
                  height: '52px',
                  maxWidth: '140px',
                  objectFit: 'contain',
                  display: 'block',
                  marginBottom: '10px',
                }}
              />
            ) : null}
            {company.name && (
              <p style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px' }}>
                {company.name}
              </p>
            )}
            {company.address && (
              <p style={{ color: MUTED, whiteSpace: 'pre-wrap', marginBottom: '2px' }}>
                {company.address}
              </p>
            )}
            {company.phone && <p style={{ color: MUTED }}>{company.phone}</p>}
          </div>

          {/* Right — INVOICE title + meta */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p
              style={{
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                marginBottom: '10px',
                color: DARK,
              }}
            >
              INVOICE
            </p>
            <table style={{ marginLeft: 'auto', borderCollapse: 'collapse' }}>
              <tbody>
                <MetaRow label="Invoice No." value={invoice.number} />
                <MetaRow label="Date" value={invoice.date} />
                <MetaRow label="Payment Terms" value={invoice.paymentTerms || 'Due on receipt'} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Full-width divider */}
        <div style={{ borderTop: `2px solid ${DARK}`, marginBottom: '20px' }} />

        {/* ═══ BILL TO ═══ */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: MUTED,
              marginBottom: '8px',
            }}
          >
            Bill To
          </p>
          {client ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <BillRow label="Client" value={client.name} bold />
              {client.contactPerson && <BillRow label="To" value={client.contactPerson} />}
              {projectLabel && <BillRow label="Project" value={projectLabel} />}
              {client.address && <BillRow label="Address" value={client.address} />}
              {client.phone && <BillRow label="TEL" value={client.phone} />}
              {client.email && <BillRow label="Email" value={client.email} />}
            </div>
          ) : (
            <p style={{ color: '#a0a0a0', fontStyle: 'italic' }}>No client selected</p>
          )}
        </div>

        {/* ═══ LINE ITEMS TABLE ═══ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <colgroup>
            <col style={{ width: '28px' }} />
            <col />
            <col style={{ width: '52px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '90px' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: BRAND }}>
              <th
                style={{
                  textAlign: 'center',
                  padding: '8px 6px',
                  color: DARK,
                  fontWeight: 700,
                  fontSize: '10px',
                }}
              >
                No.
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  color: DARK,
                  fontWeight: 700,
                  fontSize: '10px',
                }}
              >
                Description / Scope of Work
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '8px 10px',
                  color: DARK,
                  fontWeight: 700,
                  fontSize: '10px',
                }}
              >
                Qty
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '8px 10px',
                  color: DARK,
                  fontWeight: 700,
                  fontSize: '10px',
                }}
              >
                Unit Price
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '8px 10px',
                  color: DARK,
                  fontWeight: 700,
                  fontSize: '10px',
                }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${LIGHT}` }}>
                <td
                  style={{
                    padding: '9px 6px',
                    textAlign: 'center',
                    verticalAlign: 'top',
                    color: MUTED,
                    fontSize: '10px',
                  }}
                >
                  {i + 1}
                </td>
                <td
                  style={{
                    padding: '9px 10px',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                    paddingRight: '12px',
                  }}
                >
                  {(() => {
                    const nlIdx = item.description.indexOf('\n');
                    const title =
                      nlIdx === -1 ? item.description : item.description.slice(0, nlIdx);
                    const scope = nlIdx === -1 ? '' : item.description.slice(nlIdx + 1);
                    return (
                      <>
                        <p style={{ fontWeight: 600, color: DARK }}>{title}</p>
                        {scope && (
                          <p
                            style={{
                              marginTop: '4px',
                              color: MUTED,
                              fontSize: '10px',
                              whiteSpace: 'pre-wrap',
                              lineHeight: '1.7',
                            }}
                          >
                            {scope}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td
                  style={{
                    padding: '9px 10px',
                    textAlign: 'center',
                    verticalAlign: 'top',
                    color: MUTED,
                  }}
                >
                  {item.qty}
                </td>
                <td
                  style={{
                    padding: '9px 10px',
                    textAlign: 'right',
                    verticalAlign: 'top',
                    color: MUTED,
                  }}
                >
                  {fmt(item.unitPrice)}
                </td>
                <td
                  style={{
                    padding: '9px 10px',
                    textAlign: 'right',
                    verticalAlign: 'top',
                    fontWeight: 700,
                  }}
                >
                  {fmt(item.qty * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══ TOTALS ═══ */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div
            style={{
              minWidth: '220px',
              backgroundColor: '#e8e8e8',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            {/* Grand Total row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderBottom: `1px solid ${LIGHT}`,
                gap: '40px',
              }}
            >
              <span style={{ color: MUTED }}>Grand Total</span>
              <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
            </div>
            {/* WHT row */}
            {whtAmount != null && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 12px',
                  borderBottom: `1px solid ${LIGHT}`,
                  gap: '40px',
                  color: '#c2410c',
                }}
              >
                <span>Less WHT {WHT_RATE * 100}% (USD)</span>
                <span style={{ fontWeight: 600 }}>({fmt(whtAmount)})</span>
              </div>
            )}
            {/* Deposit row */}
            {depositAmount != null && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 12px',
                  borderBottom: `1px solid ${LIGHT}`,
                  gap: '40px',
                  color: '#166534',
                }}
              >
                <span>Deposit ({invoice.depositPercent}%)</span>
                <span style={{ fontWeight: 600 }}>({fmt(depositAmount)})</span>
              </div>
            )}
            {/* Total / Balance Due */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                gap: '40px',
                borderTop: `2px solid ${DARK}`,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '12px' }}>
                {depositAmount != null
                  ? 'Balance Due'
                  : whtAmount != null
                    ? 'Total (USD)'
                    : 'Grand Total'}
              </span>
              <span style={{ fontWeight: 800, fontSize: '12px' }}>
                {fmt(balanceDue ?? netTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ NOTES ═══ */}
        {invoice.notes && (
          <div style={{ marginBottom: '16px' }}>
            <p
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: MUTED,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '4px',
              }}
            >
              Notes
            </p>
            <p style={{ color: MUTED, whiteSpace: 'pre-wrap', fontSize: '10.5px' }}>
              {invoice.notes}
            </p>
          </div>
        )}

        {/* ═══ USAGE RIGHTS ═══ */}
        <div
          style={{
            border: `1px solid ${LIGHT}`,
            borderRadius: '4px',
            padding: '10px 12px',
            marginBottom: '0',
          }}
        >
          <p style={{ fontWeight: 700, fontSize: '10.5px', marginBottom: '4px' }}>Usage Rights</p>
          <p style={{ color: MUTED, fontSize: '10px', lineHeight: '1.6' }}>
            The work delivered under this invoice is <strong>non-exclusive</strong>. The client may
            use the materials within the agreed scope of work for publishing and promotional
            boosting for a period of <strong>3 months</strong> from the invoice date. Any usage,
            re-use, or boosting beyond this period will require an additional service fee.
          </p>
        </div>

        {/* ── Spacer pushes payment to bottom ── */}
        <div style={{ flex: 1 }} />

        {/* ═══ SIGNATURES ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '28px' }}>
          {/* Customer */}
          <div style={{ paddingRight: '24px' }}>
            <p style={{ fontSize: '10.5px', color: MUTED, marginBottom: '0' }}>
              Customer&apos;s signature
            </p>
            {/* Fixed-height signature area */}
            <div style={{ height: '56px' }} />
            <div style={{ borderTop: `1.5px solid ${DARK}`, width: '160px', paddingTop: '5px' }}>
              <p style={{ fontSize: '10.5px', color: MUTED }}>&nbsp;</p>
            </div>
          </div>

          {/* Seller */}
          <div style={{ paddingLeft: '24px', borderLeft: `1px solid ${LIGHT}` }}>
            <p style={{ fontSize: '10.5px', color: MUTED, marginBottom: '0' }}>
              Seller&apos;s signature
            </p>
            {/* Same fixed-height area — image fits inside */}
            <div style={{ height: '56px', display: 'flex', alignItems: 'flex-end' }}>
              {company.signatorySignature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.signatorySignature}
                  alt="Signature"
                  style={{
                    maxHeight: '52px',
                    maxWidth: '180px',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : null}
            </div>
            <div style={{ borderTop: `1.5px solid ${DARK}`, width: '160px', paddingTop: '5px' }}>
              <p
                style={{
                  fontSize: '10.5px',
                  fontWeight: company.signatoryName ? 600 : 400,
                  color: company.signatoryName ? DARK : MUTED,
                }}
              >
                {company.signatoryName || '\u00A0'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Payment divider ── */}
        <div style={{ borderTop: `1px solid ${LIGHT}`, marginBottom: '14px' }} />

        {/* ═══ PAYMENT INFORMATION ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p
              style={{
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: DARK,
                marginBottom: '10px',
              }}
            >
              Payment Information
            </p>
            {hasPayment ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {payment.bankName && <PayRow label="Bank's name" value={payment.bankName} />}
                {payment.accountName && <PayRow label="Account Name" value={payment.accountName} />}
                {payment.accountNumber && (
                  <PayRow label="Account Number" value={payment.accountNumber} />
                )}
                {payment.swiftCode && <PayRow label="ABA / SWIFT" value={payment.swiftCode} />}
                {payment.currency && <PayRow label="Currency" value={payment.currency} />}
              </div>
            ) : (
              <p style={{ color: MUTED, fontStyle: 'italic', fontSize: '10px' }}>
                No payment information set.
              </p>
            )}
          </div>

          {/* QR code */}
          {payment.qrImage && (
            <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: '20px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={payment.qrImage}
                alt="Payment QR"
                style={{ width: '72px', height: '72px', objectFit: 'contain', display: 'block' }}
              />
              <p style={{ fontSize: '9px', color: MUTED, marginTop: '3px' }}>Scan to pay</p>
            </div>
          )}
        </div>

        {/* ── Thank you ── */}
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <p style={{ fontSize: '10.5px', color: MUTED, letterSpacing: '0.03em' }}>
            Thank you for your business
          </p>
        </div>
      </div>
      {/* /padding wrapper */}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          paddingRight: '16px',
          paddingBottom: '3px',
          color: MUTED,
          textAlign: 'right',
          fontSize: '11px',
        }}
      >
        {label}
      </td>
      <td
        style={{
          paddingBottom: '3px',
          fontWeight: 700,
          textAlign: 'right',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function BillRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 0, fontSize: '11px', lineHeight: '1.6' }}>
      <span style={{ color: MUTED, minWidth: '54px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: MUTED, marginRight: '6px' }}>:</span>
      <span style={{ color: DARK, fontWeight: bold ? 700 : 400, flex: 1 }}>{value}</span>
    </div>
  );
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        fontSize: '11px',
        lineHeight: '1.5',
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: MUTED, minWidth: '110px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 700, color: DARK }}>{value}</span>
    </div>
  );
}
