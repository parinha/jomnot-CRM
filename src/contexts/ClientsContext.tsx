'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Client } from '@/src/types';
import { useFirestoreCache } from '@/src/hooks/useFirestoreCache';

interface ClientsCtx {
  clients: Client[];
  setClients: (v: Client[] | ((prev: Client[]) => Client[])) => void;
  loading: boolean;
}

const Ctx = createContext<ClientsCtx | null>(null);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients, loading] = useFirestoreCache<Client>('ei24_clients', 'clients', [], {
    liveSync: true,
  });

  return <Ctx.Provider value={{ clients, setClients, loading }}>{children}</Ctx.Provider>;
}

export function useClientsContext(): ClientsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClientsContext must be used within ClientsProvider');
  return ctx;
}
