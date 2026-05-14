'use client';

import { useState, createElement } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createRoot } from 'react-dom/client';
import type { Invoice, Client, CompanyProfile, PaymentInfo } from '@/src/types';
import { fmtUSD, fmtCurrency } from '@/src/lib/formatters';
import { WHT_RATE } from '@/src/features/invoices/lib/calculations';

// ── Design tokens ──────────────────────────────────────────────────────────────
const DARK = '#1a1a1a';
const MUTED = '#71717a';
const LIGHT = '#e4e4e7';
const BRAND = '#FFC206';

interface Props {
  invoice: Invoice;
  client: Client | null;
  company: CompanyProfile;
  payment: PaymentInfo;
  taxLabel?: string;
  taxRate?: number;
  taxType?: 'additive' | 'deductive';
  currencyCode?: string;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

export default function InvoicePrint({
  invoice,
  client,
  company,
  payment,
  taxLabel,
  taxRate,
  taxType,
  currencyCode,
}: Props) {
  const [ios] = useState(() => isIOS());
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  const effectiveTaxRate = taxRate ?? WHT_RATE * 100;
  const subtotal = invoice.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const whtAmount = invoice.withWHT ? subtotal * (effectiveTaxRate / 100) : null;
  const netTotal =
    invoice.withWHT && taxType !== 'additive' ? subtotal * (1 - effectiveTaxRate / 100) : subtotal;
  const depositAmount =
    invoice.depositPercent != null ? netTotal * (invoice.depositPercent / 100) : null;
  const balanceDue = depositAmount != null ? netTotal - depositAmount : null;

  async function generatePdfBlob(): Promise<Blob> {
    const [html2canvas, { default: jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ]);

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
    document.body.appendChild(container);

    const root = createRoot(container);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(Sheet, {
          invoice,
          client,
          company,
          payment,
          subtotal,
          whtAmount,
          netTotal,
          depositAmount,
          balanceDue,
          taxLabel,
          taxRate,
          taxType,
          currencyCode,
        })
      );
      setTimeout(resolve, 900);
    });

    const sheetEl = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(sheetEl, {
      useCORS: true,
      scale: 5,
      logging: false,
      backgroundColor: '#ffffff',
    });
    root.unmount();
    document.body.removeChild(container);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfW = 210;
    const pdfH = (canvas.height / canvas.width) * pdfW;
    pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, pdfW, pdfH);
    return pdf.output('blob');
  }

  async function sendToTelegram() {
    const token = payment.telegramBotToken?.trim();
    const chatId = payment.telegramChatId?.trim();
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSendingTelegram(true);
    setTelegramStatus('idle');
    try {
      const pdfBlob = await generatePdfBlob();
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', pdfBlob, `${invoice.number}.pdf`);
      const caption = [
        `📄 *${invoice.number}*`,
        `📅 Date: ${invoice.date}`,
        `👤 Client: ${client?.name ?? '—'}`,
      ].join('\n');
      formData.append('caption', caption);
      formData.append('parse_mode', 'Markdown');
      if (payment.telegramTopicId?.trim())
        formData.append('message_thread_id', payment.telegramTopicId.trim());
      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(`Telegram error: ${err.description ?? res.statusText}`);
        setTelegramStatus('err');
      } else {
        setTelegramStatus('ok');
        setTimeout(() => setTelegramStatus('idle'), 3000);
      }
    } catch (e) {
      toast.error(`Failed to send: ${e instanceof Error ? e.message : 'unknown error'}`);
      setTelegramStatus('err');
    } finally {
      setSendingTelegram(false);
    }
  }

  return (
    <>
      {/* Screen toolbar */}
      <div className="no-print fixed top-0 inset-x-0 z-10 bg-zinc-800 text-white">
        <div className="flex items-center justify-between px-3 sm:px-6 py-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/invoices"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:bg-white/30 transition shrink-0"
              title="Back to invoices"
            >
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="font-medium truncate text-sm">{invoice.number}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={sendToTelegram}
              disabled={sendingTelegram}
              title="Send to Telegram"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-xl bg-[#229ED9] text-white text-sm font-medium hover:bg-[#1a8bbf] active:bg-[#1578a0] disabled:opacity-60 transition"
            >
              {sendingTelegram ? (
                <svg className="w-5 h-5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : telegramStatus === 'ok' ? (
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 1 0 24 12 12.016 12.016 0 0 0 11.944 0zm5.935 7.242-2.013 9.486c-.147.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.658-.643.136-.953l11.566-4.461c.537-.194 1.006.131.88.735z" />
                </svg>
              )}
              <span className="hidden sm:inline">
                {sendingTelegram ? 'Sending…' : telegramStatus === 'ok' ? 'Sent!' : 'Telegram'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                window.focus();
                setTimeout(() => window.print(), 0);
              }}
              title="Save as PDF / Print"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-xl bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100 active:bg-zinc-200 transition"
            >
              <svg
                className="w-5 h-5 shrink-0"
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
              <span className="hidden sm:inline">Save as PDF</span>
            </button>
          </div>
        </div>

        {ios && (
          <div className="flex items-center justify-center gap-1.5 px-4 pb-2 text-zinc-400 text-xs">
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            To save PDF: tap <strong className="text-white mx-0.5">Share</strong> →{' '}
            <strong className="text-white mx-0.5">Print</strong>
          </div>
        )}
      </div>

      <div
        className="no-print min-h-screen bg-zinc-200 overflow-x-auto py-10 px-4"
        style={{ paddingTop: ios ? '6.5rem' : '5rem' }}
      >
        <div className="flex justify-center min-w-[210mm]">
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
            taxLabel={taxLabel}
            taxRate={taxRate}
            taxType={taxType}
            currencyCode={currencyCode}
          />
        </div>
      </div>

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
          taxLabel={taxLabel}
          taxRate={taxRate}
          taxType={taxType}
          currencyCode={currencyCode}
        />
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            background-color: white !important;
            color: #1a1a1a !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          img {
            image-rendering: -webkit-optimize-contrast !important;
            image-rendering: crisp-edges !important;
          }
          .no-print   { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────────

export function Sheet({
  invoice,
  client,
  company,
  payment,
  subtotal,
  whtAmount,
  netTotal,
  depositAmount,
  balanceDue,
  taxLabel,
  taxRate,
  taxType,
  currencyCode,
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
  taxLabel?: string;
  taxRate?: number;
  taxType?: 'additive' | 'deductive';
  currencyCode?: string;
}) {
  const fmt = (n: number) => fmtCurrency(n, currencyCode ?? 'USD');
  const effectiveTaxLabel = taxLabel ?? 'WHT';
  const effectiveTaxRate = taxRate ?? WHT_RATE * 100;
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
      <div style={{ padding: '14mm 14mm 10mm', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}
        >
          <div style={{ maxWidth: '55%' }}>
            {company.logo ? (
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
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${DARK}`, marginBottom: '20px' }} />

        {/* Bill To */}
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
              {invoice.showVatTin && client.vat_tin && (
                <BillRow label="VAT TIN" value={client.vat_tin} />
              )}
              {client.email && <BillRow label="Email" value={client.email} />}
            </div>
          ) : (
            <p style={{ color: '#a0a0a0', fontStyle: 'italic' }}>No client selected</p>
          )}
        </div>

        {/* Line items table */}
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
              {[
                ['No.', 'center', '6px'],
                ['Description / Scope of Work', 'left', '10px'],
                ['Qty', 'center', '10px'],
                ['Unit Price', 'right', '10px'],
                ['Total', 'right', '10px'],
              ].map(([label, align, px]) => (
                <th
                  key={label}
                  style={{
                    textAlign: align as 'left' | 'right' | 'center',
                    padding: `8px ${px}`,
                    color: DARK,
                    fontWeight: 700,
                    fontSize: '10px',
                  }}
                >
                  {label}
                </th>
              ))}
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
                    const scopeLines = scope
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return (
                      <>
                        <p style={{ fontWeight: 600, color: DARK }}>{title}</p>
                        {scopeLines.length > 0 && (
                          <ul
                            style={{
                              marginTop: '5px',
                              paddingLeft: '0',
                              listStyle: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                            }}
                          >
                            {scopeLines.map((line, idx) => (
                              <li
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  color: MUTED,
                                  fontSize: '10px',
                                  lineHeight: '1.5',
                                }}
                              >
                                <span
                                  style={{
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    backgroundColor: MUTED,
                                    flexShrink: 0,
                                    display: 'inline-block',
                                  }}
                                />
                                {line}
                              </li>
                            ))}
                          </ul>
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

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div
            style={{
              minWidth: '220px',
              backgroundColor: '#e8e8e8',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
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
                <span>
                  {taxType === 'additive' ? 'Add' : 'Less'} {effectiveTaxLabel} {effectiveTaxRate}%
                </span>
                <span style={{ fontWeight: 600 }}>({fmt(whtAmount)})</span>
              </div>
            )}
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

        <div style={{ flex: 1 }} />

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '28px' }}>
          <div style={{ paddingRight: '24px' }}>
            <p style={{ fontSize: '10.5px', color: MUTED, marginBottom: '0' }}>
              Customer&apos;s signature
            </p>
            <div style={{ height: '56px' }} />
            <div style={{ borderTop: `1.5px solid ${DARK}`, width: '160px', paddingTop: '5px' }}>
              <p style={{ fontSize: '10.5px', color: MUTED }}>&nbsp;</p>
            </div>
          </div>
          <div style={{ paddingLeft: '24px', borderLeft: `1px solid ${LIGHT}` }}>
            <p style={{ fontSize: '10.5px', color: MUTED, marginBottom: '0' }}>
              Seller&apos;s signature
            </p>
            <div style={{ height: '56px', display: 'flex', alignItems: 'flex-end' }}>
              {company.signatorySignature ? (
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

        <div style={{ borderTop: `1px solid ${LIGHT}`, marginBottom: '14px' }} />

        {/* Payment info */}
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
          {payment.qrImage && (
            <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: '20px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={payment.qrImage}
                alt="Payment QR"
                style={{
                  width: '140px',
                  height: '140px',
                  objectFit: 'contain',
                  display: 'block',
                  imageRendering: 'crisp-edges',
                }}
              />
              <p style={{ fontSize: '9px', color: MUTED, marginTop: '4px' }}>Scan to pay</p>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <p style={{ fontSize: '10.5px', color: MUTED, letterSpacing: '0.03em' }}>
            Thank you for your business
          </p>
        </div>
      </div>
    </div>
  );
}

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
