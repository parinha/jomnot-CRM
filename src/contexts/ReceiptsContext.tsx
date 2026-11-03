'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Receipt } from '@/src/types';
import { useFirestoreCache } from '@/src/hooks/useFirestoreCache';

interface ReceiptsCtx {
  receipts: Receipt[];
  loading: boolean;
}

const Ctx = createContext<ReceiptsCtx | null>(null);

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const [receipts, , loading] = useFirestoreCache<Receipt>('ei24_receipts', 'receipts', [], {
    liveSync: true,
  });
  return <Ctx.Provider value={{ receipts, loading }}>{children}</Ctx.Provider>;
}

export function useReceiptsContext(): ReceiptsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReceiptsContext must be used within ReceiptsProvider');
  return ctx;
}
