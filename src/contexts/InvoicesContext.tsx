'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Invoice } from '@/src/types';
import { useFirestoreCache } from '@/src/hooks/useFirestoreCache';

interface InvoicesCtx {
  invoices: Invoice[];
  setInvoices: (v: Invoice[] | ((prev: Invoice[]) => Invoice[])) => void;
  loading: boolean;
}

const Ctx = createContext<InvoicesCtx | null>(null);

export function InvoicesProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices, loading] = useFirestoreCache<Invoice>(
    'ei24_invoices',
    'invoices',
    [],
    { liveSync: true }
  );

  return <Ctx.Provider value={{ invoices, setInvoices, loading }}>{children}</Ctx.Provider>;
}

export function useInvoicesContext(): InvoicesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInvoicesContext must be used within InvoicesProvider');
  return ctx;
}
