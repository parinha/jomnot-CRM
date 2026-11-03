'use client';

import {
  Check,
  CircleNotch,
  House,
  Printer,
  ShareNetwork,
  TelegramLogo,
} from '@phosphor-icons/react';
import { useState, createElement } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type {
  AppPreferences,
  Client,
  CompanyProfile,
  Invoice,
  PaymentInfo,
  Receipt,
} from '@/src/types';
import { fmtCurrency, fmtDate } from '@/src/lib/formatters';
import { amountInWords, invoiceTotals, r2, RECEIPT_KIND_LABEL } from '@/src/lib/receipt';
import { telegramTarget, sendTelegramDocument, sheetToPdfBlob } from '@/src/lib/pdf';

// ── Design tokens (same as the invoice PDF) ───────────────────────────────────
const DARK = '#1a1a1a';
const MUTED = '#71717a';
const LIGHT = '#e4e4e7';
const BRAND = '#FFC206';
const OK = '#15803d';
const OK_SOFT = '#ecfdf3';
const WARN = '#b45309';

export interface ReceiptSheetProps {
  receipt: Receipt;
  invoice: Invoice | null;
  client: Client | null;
  company: CompanyProfile;
  taxLabel?: string;
  taxRate?: number;
  taxType?: 'additive' | 'deductive';
  currencyCode?: string;
  dateFormat?: AppPreferences['dateFormat'];
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

export function receiptCaption(
  receipt: Receipt,
  invoice: Invoice | null,
  client: Client | null,
  amount: string,
  dateStr: string
) {
  return [
    `🧾 *Receipt ${receipt.number}*`,
    invoice ? `📄 Invoice: ${invoice.number}` : '',
    `💵 Received: ${amount} (${RECEIPT_KIND_LABEL[receipt.kind]})`,
    `📅 Date paid: ${dateStr}`,
    `👤 Client: ${client?.name ?? '—'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function ReceiptPrint(props: ReceiptSheetProps & { payment: PaymentInfo }) {
  const { payment, ...sheetProps } = props;
  const { receipt, invoice, client, currencyCode, dateFormat } = sheetProps;
  const [ios] = useState(() => isIOS());
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  async function sendToTelegram() {
    const { token, chatId, topicId } = telegramTarget(payment, 'receipt');
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSending(true);
    try {
      const blob = await sheetToPdfBlob(createElement(ReceiptSheet, sheetProps), 5);
      await sendTelegramDocument({
        token,
        chatId,
        topicId,
        blob,
        filename: `${receipt.number}.pdf`,
        caption: receiptCaption(
          receipt,
          invoice,
          client,
          fmtCurrency(receipt.amount, currencyCode ?? 'USD'),
          fmtDate(receipt.date, dateFormat)
        ),
      });
      setSentOk(true);
      setTimeout(() => setSentOk(false), 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="no-print fixed top-0 inset-x-0 z-10 bg-surface text-ink shadow-card">
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/invoices"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-full bg-subtle text-ink text-sm font-medium hover:bg-black/[0.06] active:bg-black/[0.09] transition"
              title="Back to invoices"
            >
              <House className="w-5 h-5 shrink-0" weight="duotone" aria-hidden />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="font-semibold truncate text-base">{receipt.number}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={sendToTelegram}
              disabled={sending}
              title="Send to Telegram"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-full bg-[#229ED9] text-white text-sm font-medium hover:bg-[#1a8bbf] active:bg-[#167aa8] transition disabled:opacity-60"
            >
              {sending ? (
                <CircleNotch className="w-5 h-5 animate-spin shrink-0" weight="bold" aria-hidden />
              ) : sentOk ? (
                <Check className="w-5 h-5 shrink-0" weight="bold" aria-hidden />
              ) : (
                <TelegramLogo className="w-5 h-5 shrink-0" weight="duotone" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {sending ? 'Sending…' : sentOk ? 'Sent!' : 'Telegram'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.focus();
                setTimeout(() => window.print(), 0);
              }}
              title="Save as PDF / Print"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark transition"
            >
              <Printer className="w-5 h-5 shrink-0" weight="duotone" aria-hidden />
              <span className="hidden sm:inline">Save as PDF</span>
            </button>
          </div>
        </div>
        {ios && (
          <div className="flex items-center justify-center gap-1.5 px-4 pb-2.5 text-muted text-xs">
            <ShareNetwork className="w-3.5 h-3.5 shrink-0" weight="duotone" aria-hidden />
            To save PDF: tap <strong className="text-ink mx-0.5">Share</strong> →{' '}
            <strong className="text-ink mx-0.5">Print</strong>
          </div>
        )}
      </div>

      <div
        className="no-print min-h-screen bg-canvas overflow-x-auto py-10 px-4"
        style={{ paddingTop: ios ? '6.5rem' : '5rem' }}
      >
        <div className="flex justify-center min-w-[210mm]">
          <ReceiptSheet {...sheetProps} />
        </div>
      </div>

      <div className="print-only">
        <ReceiptSheet {...sheetProps} />
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0 !important; padding: 0 !important;
            background: white !important; background-color: white !important;
            color: #1a1a1a !important; display: block !important;
            height: auto !important; min-height: 0 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          img { image-rendering: -webkit-optimize-contrast !important; image-rendering: crisp-edges !important; }
          .no-print   { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────────

const sectionLabel = {
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: MUTED,
} as const;

export function ReceiptSheet({
  receipt,
  invoice,
  client,
  company,
  taxLabel,
  taxRate,
  taxType,
  currencyCode,
  dateFormat,
}: ReceiptSheetProps) {
  const code = currencyCode ?? 'USD';
  const fmt = (n: number) => fmtCurrency(n, code);
  const fd = (s: string) => fmtDate(s, dateFormat);
  const totals = invoice ? invoiceTotals(invoice, { taxRate, taxType }) : null;
  const effectiveTaxRate = taxRate ?? 15;
  const balance = Math.max(0, r2(receipt.invoiceTotal - receipt.previouslyPaid - receipt.amount));
  const paidSoFar = r2(receipt.previouslyPaid + receipt.amount);
  const fullyPaid = balance <= 0.005;
  const pct = (n: number) => (receipt.invoiceTotal > 0 ? (n / receipt.invoiceTotal) * 100 : 0);
  const showProgress = receipt.showProgress && (receipt.kind !== 'full' || !fullyPaid);
  const projectLabel = invoice?.projectName || '';

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
        position: 'relative',
      }}
    >
      {receipt.showStamp && (
        <div
          style={{
            position: 'absolute',
            top: '62px',
            left: '50%',
            transform: 'translateX(-30%) rotate(-12deg)',
            color: fullyPaid ? OK : WARN,
            border: '3px solid currentColor',
            borderRadius: '8px',
            padding: '6px 16px 4px',
            textAlign: 'center',
            opacity: 0.82,
          }}
        >
          <p style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.14em', lineHeight: 1 }}>
            {fullyPaid ? 'PAID' : 'DEPOSIT PAID'}
          </p>
          <p
            style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', marginTop: '3px' }}
          >
            {fd(receipt.date)}
          </p>
        </div>
      )}

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
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p
              style={{
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                marginBottom: '10px',
              }}
            >
              RECEIPT
            </p>
            <table style={{ marginLeft: 'auto', borderCollapse: 'collapse' }}>
              <tbody>
                <MetaRow label="Receipt No." value={receipt.number} />
                <MetaRow label="Date paid" value={fd(receipt.date)} />
                {invoice && <MetaRow label="Invoice No." value={invoice.number} />}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${DARK}`, marginBottom: '20px' }} />

        {/* Received from + amount card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '28px',
            marginBottom: '22px',
          }}
        >
          <div>
            <p style={{ ...sectionLabel, marginBottom: '8px' }}>Received From</p>
            {client ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <BillRow label="Client" value={client.name} bold />
                {client.contactPerson && <BillRow label="To" value={client.contactPerson} />}
                {projectLabel && <BillRow label="Project" value={projectLabel} />}
                {client.address && <BillRow label="Address" value={client.address} />}
                {client.phone && <BillRow label="TEL" value={client.phone} />}
              </div>
            ) : (
              <p style={{ color: '#a0a0a0', fontStyle: 'italic' }}>Client not found</p>
            )}
          </div>
          <div
            style={{
              border: `1.5px solid ${OK}`,
              background: OK_SOFT,
              borderRadius: '6px',
              padding: '12px 14px',
              alignSelf: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <p style={{ ...sectionLabel, color: OK }}>
              Amount received · {RECEIPT_KIND_LABEL[receipt.kind]}
            </p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: OK, letterSpacing: '-0.3px' }}>
              {fmt(receipt.amount)}
            </p>
            <div
              style={{
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px dashed rgba(21,128,61,.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                fontSize: '10px',
              }}
            >
              <CardRow label="Method" value={receipt.method} />
              {receipt.reference && <CardRow label="Reference" value={receipt.reference} />}
            </div>
          </div>
        </div>

        {receipt.showWords && (
          <p
            style={{
              margin: '-8px 0 20px',
              padding: '8px 12px',
              background: '#fafafa',
              borderLeft: `3px solid ${BRAND}`,
              fontSize: '10.5px',
            }}
          >
            Amount in words: <strong>{amountInWords(receipt.amount, code)}</strong>
          </p>
        )}

        {/* Line items (from the invoice) */}
        {receipt.showItems && invoice && (
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
              {invoice.items.map((item, i) => {
                const [title, ...scope] = item.description
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
                return (
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
                    <td style={{ padding: '9px 12px 9px 10px', verticalAlign: 'top' }}>
                      <p style={{ fontWeight: 600 }}>{title}</p>
                      {scope.length > 0 && (
                        <p style={{ color: MUTED, fontSize: '10px' }}>{scope.join(' · ')}</p>
                      )}
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
                );
              })}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '22px' }}>
          <div style={{ minWidth: '300px' }}>
            {receipt.showItems && totals && (
              <>
                <TotalRow label="Subtotal" value={fmt(totals.subtotal)} />
                {totals.taxAmount != null && (
                  <TotalRow
                    label={`${taxType === 'additive' ? 'Add' : 'Less'} ${taxLabel ?? 'WHT'} ${effectiveTaxRate}%`}
                    value={`(${fmt(totals.taxAmount)})`}
                    color="#c2410c"
                  />
                )}
              </>
            )}
            <TotalRow label="Invoice total" value={fmt(receipt.invoiceTotal)} />
            {receipt.previouslyPaid > 0 && (
              <TotalRow
                label="Previously paid"
                value={`(${fmt(receipt.previouslyPaid)})`}
                color={OK}
              />
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '40px',
                padding: '8px 12px',
                borderTop: `2px solid ${DARK}`,
                fontSize: '12.5px',
              }}
            >
              <span style={{ fontWeight: 700 }}>Amount received</span>
              <span style={{ fontWeight: 800 }}>{fmt(receipt.amount)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '40px',
                padding: '6px 12px',
                borderRadius: '4px',
                fontWeight: 700,
                ...(fullyPaid ? { color: OK } : { color: '#c2410c', background: '#fff7ed' }),
              }}
            >
              <span>Balance due</span>
              <span style={{ fontWeight: 800 }}>
                {fullyPaid ? `${fmt(0)} · Paid in full` : fmt(balance)}
              </span>
            </div>
          </div>
        </div>

        {showProgress && (
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                height: '8px',
                borderRadius: '9px',
                background: LIGHT,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              {receipt.previouslyPaid > 0 && (
                <div style={{ width: `${pct(receipt.previouslyPaid)}%`, background: OK }} />
              )}
              <div style={{ width: `${pct(receipt.amount)}%`, background: '#4ade80' }} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '9.5px',
                color: MUTED,
                marginTop: '4px',
              }}
            >
              <span>
                Paid {fmt(paidSoFar)} of {fmt(receipt.invoiceTotal)} ({Math.round(pct(paidSoFar))}%)
              </span>
              <span>{fullyPaid ? 'Fully paid' : `Remaining ${fmt(balance)}`}</span>
            </div>
          </div>
        )}

        {receipt.message?.trim() && (
          <p
            style={{
              color: MUTED,
              fontSize: '10.5px',
              marginBottom: '14px',
              whiteSpace: 'pre-wrap',
              maxWidth: '92%',
            }}
          >
            {receipt.message.trim()}
          </p>
        )}

        <div style={{ flex: 1, minHeight: '16px' }} />

        {/* Signatures */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: receipt.showCustomerSignature ? '1fr 1fr' : '1fr',
            justifyItems: receipt.showCustomerSignature ? 'stretch' : 'end',
            marginBottom: '24px',
          }}
        >
          {receipt.showCustomerSignature && (
            <div style={{ paddingRight: '24px' }}>
              <p style={{ fontSize: '10.5px', color: MUTED }}>Customer&apos;s signature</p>
              <div style={{ height: '56px' }} />
              <div style={{ borderTop: `1.5px solid ${DARK}`, width: '160px', paddingTop: '5px' }}>
                <p style={{ fontSize: '10.5px' }}>&nbsp;</p>
              </div>
            </div>
          )}
          <div
            style={
              receipt.showCustomerSignature
                ? { paddingLeft: '24px', borderLeft: `1px solid ${LIGHT}` }
                : {}
            }
          >
            <p style={{ fontSize: '10.5px', color: MUTED }}>Received by</p>
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
                {company.signatoryName || ' '}
              </p>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${LIGHT}`, marginBottom: '12px' }} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            fontSize: '9.5px',
            color: MUTED,
          }}
        >
          <span>{invoice ? `This receipt was issued for invoice ${invoice.number}.` : ''}</span>
          <span>Thank you for your business</span>
        </div>
      </div>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: `1px solid ${LIGHT}`,
        gap: '40px',
        color: color ?? DARK,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
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
    <div style={{ display: 'flex', fontSize: '11px', lineHeight: '1.6' }}>
      <span style={{ color: MUTED, minWidth: '54px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: MUTED, marginRight: '6px' }}>:</span>
      <span style={{ fontWeight: bold ? 700 : 400, flex: 1 }}>{value}</span>
    </div>
  );
}
