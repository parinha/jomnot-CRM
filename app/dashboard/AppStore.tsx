'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { collection, doc, onSnapshot, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/app/_lib/firebase';
import { auth } from '@/app/_lib/auth';
import { DEFAULT_SCOPES, type TelegramTemplate } from '@/app/_config/constants';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface RecordMeta {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

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
  telegramTemplate?: TelegramTemplate;
}

export type { TelegramTemplate };

export type ProjectItemStatus = 'todo' | 'in-progress' | 'done';

export interface ProjectItem {
  id: string;
  description: string;
  status: ProjectItemStatus;
}

export type ProjectStatus = 'draft' | 'confirmed' | 'in-progress' | 'on-hold' | 'completed';

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
  filmingDate?: string;
  deliverDate?: string;
  completedAt?: string;
  budget?: number;
  note?: string;
}

// ── Firestore paths ───────────────────────────────────────────────────────────

const COL = {
  clients: 'clients',
  invoices: 'invoices',
  projects: 'projects',
};

const SETTINGS_DOC = {
  company: () => doc(db, 'settings', 'company'),
  payment: () => doc(db, 'settings', 'payment'),
  scopes: () => doc(db, 'settings', 'scopes'),
};

const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  logo: '',
  address: '',
  phone: '',
  website: '',
  signatoryName: '',
  signatorySignature: '',
};
const EMPTY_PAYMENT: PaymentInfo = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  swiftCode: '',
  currency: '',
  qrImage: '',
};

// ── Store interface ───────────────────────────────────────────────────────────

interface AppStore {
  loading: boolean;
  clients: Client[];
  setClients: (c: Client[]) => void;
  invoices: Invoice[];
  setInvoices: (inv: Invoice[]) => void;
  projects: Project[];
  setProjects: (p: Project[]) => void;
  scopeOfWork: string[];
  setScopeOfWork: (s: string[]) => void;
  companyProfile: CompanyProfile;
  setCompanyProfile: (p: CompanyProfile) => void;
  paymentInfo: PaymentInfo;
  setPaymentInfo: (p: PaymentInfo) => void;
  amountsVisible: boolean;
  toggleAmountsVisible: () => void;
}

const StoreCtx = createContext<AppStore | null>(null);

// ── Audit helpers ─────────────────────────────────────────────────────────────

function currentUser(): string {
  return auth.currentUser?.email ?? auth.currentUser?.uid ?? 'unknown';
}

function now(): string {
  return new Date().toISOString();
}

// ── Batch-diff with createdBy / updatedBy ─────────────────────────────────────

function batchReplace<T extends { id: string } & RecordMeta>(
  colName: string,
  current: T[],
  next: T[]
): void {
  const batch = writeBatch(db);
  const currentMap = new Map(current.map((x) => [x.id, x]));
  const nextIds = new Set(next.map((x) => x.id));
  const user = currentUser();
  const ts = now();

  // deletions
  current.filter((x) => !nextIds.has(x.id)).forEach((x) => batch.delete(doc(db, colName, x.id)));

  // upserts with audit fields
  next.forEach((x) => {
    const existing = currentMap.get(x.id);
    const raw = existing
      ? { ...x, updatedBy: user, updatedAt: ts } // update
      : { ...x, createdBy: user, createdAt: x.createdAt ?? ts, updatedBy: user, updatedAt: ts }; // create
    // Firestore rejects undefined values — strip them out
    const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
    batch.set(doc(db, colName, x.id), data);
  });

  batch.commit().catch(console.error);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClientsState] = useState<Client[]>([]);
  const [invoices, setInvoicesState] = useState<Invoice[]>([]);
  const [projects, setProjectsState] = useState<Project[]>([]);
  const [scopeOfWork, setScopeState] = useState<string[]>(DEFAULT_SCOPES);
  const [companyProfile, setCompanyState] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [paymentInfo, setPaymentState] = useState<PaymentInfo>(EMPTY_PAYMENT);
  const [amountsVisible, setAmountsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('amountsVisible') === 'true';
  });

  function toggleAmountsVisible() {
    setAmountsVisible((prev) => {
      const next = !prev;
      sessionStorage.setItem('amountsVisible', String(next));
      return next;
    });
  }

  useEffect(() => {
    let loaded = 0;
    const TOTAL = 5;

    function tick() {
      loaded++;
      if (loaded >= TOTAL) setLoading(false);
    }

    const unsubClients = onSnapshot(collection(db, COL.clients), (snap) => {
      setClientsState(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Client));
      tick();
    });

    const unsubInvoices = onSnapshot(collection(db, COL.invoices), (snap) => {
      setInvoicesState(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice));
      tick();
    });

    const unsubProjects = onSnapshot(collection(db, COL.projects), (snap) => {
      setProjectsState(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project));
      tick();
    });

    const unsubScopes = onSnapshot(SETTINGS_DOC.scopes(), (snap) => {
      if (snap.exists()) setScopeState((snap.data().items as string[]) ?? DEFAULT_SCOPES);
      tick();
    });

    Promise.all([getDoc(SETTINGS_DOC.company()), getDoc(SETTINGS_DOC.payment())])
      .then(([compSnap, paySnap]) => {
        if (compSnap.exists()) setCompanyState(compSnap.data() as CompanyProfile);
        if (paySnap.exists()) setPaymentState(paySnap.data() as PaymentInfo);
        tick();
      })
      .catch(console.error);

    return () => {
      unsubClients();
      unsubInvoices();
      unsubProjects();
      unsubScopes();
    };
  }, []);

  function setClients(next: Client[]) {
    batchReplace(COL.clients, clients, next);
  }

  function setInvoices(next: Invoice[]) {
    batchReplace(COL.invoices, invoices, next);
  }

  function setProjects(next: Project[]) {
    setProjectsState(next); // optimistic — update UI immediately
    batchReplace(COL.projects, projects, next);
  }

  function setScopeOfWork(items: string[]) {
    const user = currentUser();
    const ts = now();
    setDoc(SETTINGS_DOC.scopes(), { items, updatedBy: user, updatedAt: ts }).catch(console.error);
    setScopeState(items); // optimistic
  }

  function setCompanyProfile(p: CompanyProfile) {
    const user = currentUser();
    const ts = now();
    setDoc(SETTINGS_DOC.company(), { ...p, updatedBy: user, updatedAt: ts }).catch(console.error);
    setCompanyState(p); // optimistic
  }

  function setPaymentInfo(p: PaymentInfo) {
    const user = currentUser();
    const ts = now();
    setDoc(SETTINGS_DOC.payment(), { ...p, updatedBy: user, updatedAt: ts }).catch(console.error);
    setPaymentState(p); // optimistic
  }

  return (
    <StoreCtx.Provider
      value={{
        loading,
        clients,
        setClients,
        invoices,
        setInvoices,
        projects,
        setProjects,
        scopeOfWork,
        setScopeOfWork,
        companyProfile,
        setCompanyProfile,
        paymentInfo,
        setPaymentInfo,
        amountsVisible,
        toggleAmountsVisible,
      }}
    >
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider');
  return ctx;
}
