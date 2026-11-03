'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Quotation } from '@/src/types';
import { useFirestoreCache } from '@/src/hooks/useFirestoreCache';

interface QuotationsCtx {
  quotations: Quotation[];
  loading: boolean;
}

const Ctx = createContext<QuotationsCtx | null>(null);

export function QuotationsProvider({ children }: { children: ReactNode }) {
  const [quotations, , loading] = useFirestoreCache<Quotation>(
    'ei24_quotations',
    'quotations',
    [],
    { liveSync: true }
  );

  return <Ctx.Provider value={{ quotations, loading }}>{children}</Ctx.Provider>;
}

export function useQuotationsContext(): QuotationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useQuotationsContext must be used within QuotationsProvider');
  return ctx;
}
