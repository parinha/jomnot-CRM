import type { Client } from '@/src/types';
import { useClientsContext } from '@/src/contexts/ClientsContext';
import { upsertDoc, deleteDoc } from '@/src/lib/client/firestore';

export function useClients() {
  const { clients, loading } = useClientsContext();
  return {
    data: clients,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useClientMutations() {
  async function upsert(client: Client): Promise<void> {
    await upsertDoc('clients', client.id, client);
  }

  async function remove(id: string): Promise<void> {
    await deleteDoc('clients', id);
  }

  return { upsert, remove };
}
