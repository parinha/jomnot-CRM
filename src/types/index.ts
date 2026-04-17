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
