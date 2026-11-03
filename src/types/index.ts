// ── Audit metadata ─────────────────────────────────────────────────────────────

export interface RecordMeta {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

// ── Client ─────────────────────────────────────────────────────────────────────

export interface Client extends RecordMeta {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  address: string;
  email: string;
  vat_tin?: string;
  note?: string;
}

// ── Invoice ────────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';

export interface Invoice extends RecordMeta {
  id: string;
  number: string;
  date: string;
  paymentTerms: string;
  status: InvoiceStatus;
  clientId: string;
  projectName?: string;
  items: LineItem[];
  notes: string;
  depositPercent?: number;
  withWHT?: boolean;
  showVatTin?: boolean;
  paymentMethodId?: string;
}

// ── Quotation ──────────────────────────────────────────────────────────────────

export interface QuoteLineItem extends LineItem {
  /** Shown on the quote as an add-on but not counted in the total. */
  optional?: boolean;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export type QuoteTaxMode = 'none' | 'vat' | 'wht';

export interface Quotation extends RecordMeta {
  id: string;
  number: string;
  date: string;
  validDays: number;
  status: QuotationStatus;
  clientId: string;
  projectName?: string;
  items: QuoteLineItem[];
  intro?: string;
  notes: string;
  discountPercent?: number;
  taxMode: QuoteTaxMode;
  taxLabel?: string;
  taxRate?: number;
  /** Shown under the total when taxMode is 'none'. */
  taxNote?: string;
  depositMode?: 'percent' | 'amount';
  depositValue?: number;
  /** One item per line. */
  gear?: string;
  /** One term per line. */
  terms?: string;
  /** Supports **bold** markup. */
  usageRights?: string;
  showVatTin?: boolean;
  paymentMethodId?: string;
  /** Set when the quote has been converted into an invoice. */
  invoiceId?: string;
}

export interface QuotationSettings {
  validDays: number;
  depositPercent: number;
  intro: string;
  terms: string;
  usageRights: string;
  gear: string;
  taxNote: string;
}

export const DEFAULT_QUOTATION_SETTINGS: QuotationSettings = {
  validDays: 14,
  depositPercent: 50,
  intro:
    'Dear {contact},\n\nThank you for considering {company} for the {project}. We are pleased to present our quotation, which outlines the proposed scope of work, deliverables, and investment. Should you have any questions or wish to adjust the scope, please do not hesitate to contact us.',
  terms: [
    'Prices are valid until the date shown on this quotation.',
    'Work begins after the deposit is received.',
    'Includes 2 rounds of revisions per deliverable.',
    'Final files are delivered after full payment.',
  ].join('\n'),
  usageRights:
    'The work delivered under this quotation is **non-exclusive**. The client may use the materials within the agreed scope of work for publishing and promotional boosting for a period of **3 months** from the delivery date. Any usage, re-use, or boosting beyond this period will require an additional service fee.',
  gear: '',
  taxNote: 'All prices exclude VAT and other applicable taxes.',
};

export interface PaymentMethod {
  id: string;
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode: string;
  currency: string;
  qrImage: string;
  isDefault: boolean;
}

// ── Settings ───────────────────────────────────────────────────────────────────

// Invoicing tab: bank payment details + currency/date/tax display settings
export interface InvoicingSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode: string;
  currency: string; // display name e.g. "United States Dollars"
  qrImage: string;
  currencyCode: string; // ISO 4217 e.g. 'USD'
  currencySymbol: string; // '$', '€', '฿'
  dateFormat: 'DD/Mon/YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  taxEnabled: boolean;
  taxLabel: string;
  taxRate: number;
  taxType: 'additive' | 'deductive';
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  swiftCode: '',
  currency: '',
  qrImage: '',
  currencyCode: 'USD',
  currencySymbol: '$',
  dateFormat: 'DD/Mon/YYYY',
  taxEnabled: false,
  taxLabel: 'Tax',
  taxRate: 0,
  taxType: 'additive',
};

// Workspace preferences (display settings merged from invoicing + holidays)
export interface AppPreferences {
  currencyCode: string; // kept for useAppPreferences backward compat (merged from invoicing)
  currencySymbol: string;
  dateFormat: 'DD/Mon/YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  taxEnabled: boolean;
  taxLabel: string;
  taxRate: number;
  taxType: 'additive' | 'deductive';
  holidays: { date: string; name: string }[];
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  currencyCode: 'USD',
  currencySymbol: '$',
  dateFormat: 'DD/Mon/YYYY',
  taxEnabled: false,
  taxLabel: 'Tax',
  taxRate: 0,
  taxType: 'additive',
  holidays: [],
};

export interface CompanyProfile {
  name: string;
  logo: string;
  address: string;
  phone: string;
  website: string;
  signatoryName?: string;
  signatorySignature?: string;
}

export interface PaymentInfo {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode: string;
  currency: string;
  qrImage: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramTopicId?: string;
  /** Optional separate destination for quotations; falls back to the invoice chat. */
  telegramQuoteChatId?: string;
  telegramQuoteTopicId?: string;
}
