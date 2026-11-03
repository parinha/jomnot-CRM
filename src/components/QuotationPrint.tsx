'use client';

import { brandPalette } from '@/src/lib/brand';
import {
  Check,
  CircleNotch,
  House,
  Printer,
  ShareNetwork,
  TelegramLogo,
} from '@phosphor-icons/react';
import { useState, createElement, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { AppPreferences, Client, CompanyProfile, PaymentInfo, Quotation } from '@/src/types';
import { fmtCurrency, fmtDate } from '@/src/lib/formatters';
import {
  calcQuote,
  fillPlaceholders,
  splitLines,
  taxLabelFor,
  validUntil,
} from '@/src/lib/quotation';
import { telegramTarget, sendTelegramDocument, sheetToPdfBlob } from '@/src/lib/pdf';

// ── Design tokens (same as the invoice PDF) ───────────────────────────────────
const DARK = '#1a1a1a';
const MUTED = '#71717a';
const LIGHT = '#e4e4e7';

export interface QuotationSheetProps {
  quote: Quotation;
  client: Client | null;
  company: CompanyProfile;
  payment: PaymentInfo;
  currencyCode?: string;
  dateFormat?: AppPreferences['dateFormat'];
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

/** Telegram caption for a quotation. */
export function quoteCaption(quote: Quotation, client: Client | null, dateStr: string) {
  return [
    `📝 *Quotation ${quote.number}*`,
    `📅 Date: ${dateStr}`,
    `👤 Client: ${client?.name ?? '—'}`,
    quote.projectName ? `🎬 Project: ${quote.projectName}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export default function QuotationPrint(props: QuotationSheetProps) {
  const { quote, client, payment, dateFormat } = props;
  const [ios] = useState(() => isIOS());
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  async function sendToTelegram() {
    const { token, chatId, topicId } = telegramTarget(payment, 'quote');
    if (!token || !chatId) {
      toast.error('Add your Telegram Bot Token and Chat ID in Settings first.');
      return;
    }
    setSending(true);
    try {
      const blob = await sheetToPdfBlob(createElement(QuotationSheet, props), 5);
      await sendTelegramDocument({
        token,
        chatId,
        topicId,
        blob,
        filename: `${quote.number}.pdf`,
        caption: quoteCaption(quote, client, fmtDate(quote.date, dateFormat)),
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
      {/* Screen toolbar */}
      <div className="no-print fixed top-0 inset-x-0 z-10 bg-surface text-ink shadow-card">
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/quotations"
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-full bg-subtle text-ink text-sm font-medium hover:bg-black/[0.06] active:bg-black/[0.09] transition"
              title="Back to quotations"
            >
              <House className="w-5 h-5 shrink-0" weight="duotone" aria-hidden />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="font-semibold truncate text-base">{quote.number}</span>
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
              className="flex items-center gap-2 h-11 w-11 sm:w-auto sm:px-4 justify-center rounded-full bg-brand text-on-brand text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark transition"
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
          <QuotationSheet {...props} />
        </div>
      </div>

      <div className="print-only">
        <QuotationSheet {...props} />
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

/** Renders **bold** markup as <strong>. */
function withBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} style={{ color: DARK }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

const sectionLabel = {
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: MUTED,
} as const;

export function QuotationSheet({
  quote,
  client,
  company,
  payment,
  currencyCode,
  dateFormat,
}: QuotationSheetProps) {
  const fmt = (n: number) => fmtCurrency(n, currencyCode ?? 'USD');
  const { brand: BRAND, onBrand: ON_BRAND } = brandPalette(company.brandColor);
  const fd = (s: string) => fmtDate(s, dateFormat);
  const t = calcQuote(quote);
  const taxLabel = taxLabelFor(quote);
  const validDate = validUntil(quote.date, quote.validDays);
  const intro = quote.intro?.trim()
    ? fillPlaceholders(quote.intro.trim(), { client, company, projectName: quote.projectName })
    : '';
  const introParas = intro ? intro.split(/\n\s*\n/) : [];
  const gear = splitLines(quote.gear);
  const terms = splitLines(quote.terms);
  const usage = quote.usageRights?.trim() ?? '';
  const infoBoxes = [gear.length > 0, terms.length > 0, !!usage].filter(Boolean).length;
  const hasPayment =
    payment.bankName || payment.accountName || payment.accountNumber || payment.swiftCode;
  let rowNo = 0;

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
                color: DARK,
              }}
            >
              QUOTATION
            </p>
            <table style={{ marginLeft: 'auto', borderCollapse: 'collapse' }}>
              <tbody>
                <MetaRow label="Quote No." value={quote.number} />
                <MetaRow label="Date" value={fd(quote.date)} />
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${DARK}`, marginBottom: '20px' }} />

        {/* Prepared for + validity */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr',
            gap: '28px',
            marginBottom: '22px',
          }}
        >
          <div>
            <p style={{ ...sectionLabel, marginBottom: '8px' }}>Prepared For</p>
            {client ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <BillRow label="Client" value={client.name} bold />
                {client.contactPerson && <BillRow label="To" value={client.contactPerson} />}
                {quote.projectName && <BillRow label="Project" value={quote.projectName} />}
                {client.address && <BillRow label="Address" value={client.address} />}
                {client.phone && <BillRow label="TEL" value={client.phone} />}
                {quote.showVatTin && client.vat_tin && (
                  <BillRow label="VAT TIN" value={client.vat_tin} />
                )}
                {client.email && <BillRow label="Email" value={client.email} />}
              </div>
            ) : (
              <p style={{ color: '#a0a0a0', fontStyle: 'italic' }}>No client selected</p>
            )}
          </div>
          <div
            style={{
              border: `1px solid ${LIGHT}`,
              borderRadius: '6px',
              padding: '12px 14px',
              alignSelf: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <p style={sectionLabel}>Valid Until</p>
            <p style={{ fontSize: '15px', fontWeight: 800 }}>{fd(validDate)}</p>
            <div style={{ height: '4px', borderRadius: '9px', background: BRAND, width: '100%' }} />
            <p style={{ color: MUTED, fontSize: '10px' }}>
              {quote.validDays} days from issue · prices locked until then
            </p>
          </div>
        </div>

        {/* Intro */}
        {introParas.length > 0 && (
          <div
            style={{
              margin: '-6px 0 18px',
              color: MUTED,
              fontSize: '10.5px',
              lineHeight: '1.65',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxWidth: '92%',
            }}
          >
            {introParas.map((para, i) => (
              <p
                key={i}
                style={
                  i === 0 && para.startsWith('Dear')
                    ? { color: DARK, fontWeight: 600, whiteSpace: 'pre-wrap' }
                    : { whiteSpace: 'pre-wrap' }
                }
              >
                {para}
              </p>
            ))}
          </div>
        )}

        {/* Line items */}
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
                ['Amount', 'right', '10px'],
              ].map(([label, align, px]) => (
                <th
                  key={label}
                  style={{
                    textAlign: align as 'left' | 'right' | 'center',
                    padding: `8px ${px}`,
                    color: ON_BRAND,
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
            {[
              ...quote.items.filter((i) => !i.optional),
              ...quote.items.filter((i) => i.optional),
            ].map((item) => {
              const nlIdx = item.description.indexOf('\n');
              const title = nlIdx === -1 ? item.description : item.description.slice(0, nlIdx);
              const scopeLines = splitLines(nlIdx === -1 ? '' : item.description.slice(nlIdx + 1));
              const opt = !!item.optional;
              if (!opt) rowNo += 1;
              return (
                <tr
                  key={item.id}
                  style={{ borderBottom: `1px solid ${LIGHT}`, opacity: opt ? 0.7 : 1 }}
                >
                  <td
                    style={{
                      padding: '9px 6px',
                      textAlign: 'center',
                      verticalAlign: 'top',
                      color: MUTED,
                      fontSize: '10px',
                    }}
                  >
                    {opt ? '+' : rowNo}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px 9px 10px',
                      verticalAlign: 'top',
                      wordBreak: 'break-word',
                    }}
                  >
                    <p style={{ fontWeight: 600, color: DARK }}>
                      {title}
                      {opt && (
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '8.5px',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            border: `1px solid ${MUTED}`,
                            color: MUTED,
                            borderRadius: '3px',
                            padding: '0 4px',
                            marginLeft: '6px',
                            lineHeight: '1.5',
                            verticalAlign: '1px',
                          }}
                        >
                          Optional
                        </span>
                      )}
                    </p>
                    {scopeLines.length > 0 && (
                      <ul
                        style={{
                          marginTop: '5px',
                          paddingLeft: 0,
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
                      fontWeight: opt ? 400 : 700,
                      color: opt ? MUTED : DARK,
                    }}
                  >
                    {fmt(item.qty * item.unitPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '22px' }}>
          <div style={{ minWidth: '280px' }}>
            <TotalRow label="Subtotal" value={fmt(t.subtotal)} />
            {t.discount > 0 && (
              <TotalRow
                label={`Discount (${quote.discountPercent}%)`}
                value={`(${fmt(t.discount)})`}
                color="#c2410c"
              />
            )}
            {quote.taxMode === 'vat' && (
              <TotalRow label={`Add ${taxLabel} ${quote.taxRate ?? 0}%`} value={fmt(t.tax)} />
            )}
            {quote.taxMode === 'wht' && (
              <TotalRow
                label={`Less ${taxLabel} ${quote.taxRate ?? 0}%`}
                value={`(${fmt(t.tax)})`}
                color="#c2410c"
              />
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
                Quoted Total
                {quote.taxMode === 'vat' && (
                  <span style={{ fontWeight: 400, fontSize: '10px' }}> (incl. {taxLabel})</span>
                )}
              </span>
              <span style={{ fontWeight: 800, fontSize: '12px' }}>{fmt(t.total)}</span>
            </div>
            {quote.taxMode === 'none' && quote.taxNote?.trim() && (
              <p
                style={{
                  padding: '0 12px 4px',
                  fontSize: '9px',
                  fontStyle: 'italic',
                  color: MUTED,
                  textAlign: 'right',
                }}
              >
                {quote.taxNote.trim()}
              </p>
            )}
            {t.deposit != null && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 12px',
                  gap: '40px',
                  color: '#166534',
                  fontSize: '10.5px',
                }}
              >
                <span>
                  Deposit to start
                  {quote.depositMode === 'percent' ? ` (${quote.depositValue}%)` : ''}
                </span>
                <span style={{ fontWeight: 600 }}>{fmt(t.deposit)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {quote.notes?.trim() && (
          <div style={{ marginBottom: '14px' }}>
            <p style={{ ...sectionLabel, marginBottom: '4px' }}>Notes</p>
            <p style={{ color: MUTED, whiteSpace: 'pre-wrap', fontSize: '10.5px' }}>
              {quote.notes}
            </p>
          </div>
        )}

        {/* Gear + Terms + Usage rights in one row */}
        {infoBoxes > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${infoBoxes}, minmax(0, 1fr))`,
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            {gear.length > 0 && (
              <InfoBox title="Equipment & Gear">
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                  }}
                >
                  {gear.map((g, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span
                        style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          backgroundColor: DARK,
                          flexShrink: 0,
                          display: 'inline-block',
                          transform: 'translateY(-1px)',
                        }}
                      />
                      {g}
                    </li>
                  ))}
                </ul>
              </InfoBox>
            )}
            {terms.length > 0 && (
              <InfoBox title="Terms & Conditions">
                <ol style={{ margin: 0, paddingLeft: '14px', listStyle: 'decimal' }}>
                  {terms.map((term, i) => (
                    <li key={i}>{term}</li>
                  ))}
                </ol>
              </InfoBox>
            )}
            {usage && (
              <InfoBox title="Usage Rights">
                <p style={{ whiteSpace: 'pre-wrap' }}>{withBold(usage)}</p>
              </InfoBox>
            )}
          </div>
        )}

        <div style={{ flex: 1, minHeight: '16px' }} />

        {/* Signatures (same as invoice) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '28px' }}>
          <div style={{ paddingRight: '24px' }}>
            <p style={{ fontSize: '10.5px', color: MUTED }}>Customer&apos;s signature</p>
            <div style={{ height: '56px' }} />
            <div style={{ borderTop: `1.5px solid ${DARK}`, width: '160px', paddingTop: '5px' }}>
              <p style={{ fontSize: '10.5px', color: MUTED }}>&nbsp;</p>
            </div>
          </div>
          <div style={{ paddingLeft: '24px', borderLeft: `1px solid ${LIGHT}` }}>
            <p style={{ fontSize: '10.5px', color: MUTED }}>Seller&apos;s signature</p>
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

        <div style={{ borderTop: `1px solid ${LIGHT}`, marginBottom: '14px' }} />

        {/* Payment info (same as invoice) + deposit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ ...sectionLabel, color: DARK, marginBottom: '10px' }}>
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
                {t.deposit != null && <PayRow label="Deposit to start" value={fmt(t.deposit)} />}
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
            We look forward to working with you
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${LIGHT}`,
        borderRadius: '4px',
        padding: '9px 11px',
        color: MUTED,
        fontSize: '9.5px',
        lineHeight: '1.55',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: '10.5px', color: DARK, marginBottom: '4px' }}>
        {title}
      </p>
      {children}
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
