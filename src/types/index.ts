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
}
