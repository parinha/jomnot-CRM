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
}

// ── Settings ───────────────────────────────────────────────────────────────────

export interface AppPreferences {
  currencyCode: string; // ISO 4217 e.g. 'USD', 'EUR', 'THB'
  currencySymbol: string; // '$', '€', '฿'
  dateFormat: 'DD/Mon/YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  phaseLabels: [string, string, string, string, string];
  taxEnabled: boolean;
  taxLabel: string; // 'WHT', 'VAT', 'GST', 'Tax'
  taxRate: number; // percentage e.g. 15
  taxType: 'additive' | 'deductive';
  holidays: { date: string; name: string }[];
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  currencyCode: 'USD',
  currencySymbol: '$',
  dateFormat: 'DD/Mon/YYYY',
  phaseLabels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'],
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
  projectTelegramChatId?: string;
  projectTelegramTopicId?: string;
}

// ── Project ────────────────────────────────────────────────────────────────────

export type ProjectItemStatus = 'todo' | 'in-progress' | 'done';

export interface ProjectItem {
  id: string;
  description: string;
  status: ProjectItemStatus;
}

export type ProjectStatus = 'unconfirmed' | 'confirmed' | 'on-hold' | 'completed';

export interface ProjectPhases {
  filming: boolean;
  roughCut: boolean;
  draft: boolean;
  master: boolean;
  delivered: boolean;
}

export interface Project extends RecordMeta {
  id: string;
  name: string;
  clientId: string;
  invoiceIds: string[];
  items: ProjectItem[];
  phases?: ProjectPhases;
  status: ProjectStatus;
  createdAt: string;
  confirmedMonth?: string;
  filmingDate?: string;
  deliverDate?: string;
  completedAt?: string;
  budget?: number;
  note?: string;
}
