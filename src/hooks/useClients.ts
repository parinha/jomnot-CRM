import type { Client } from '@/src/types';
import { useClientsContext } from '@/src/contexts/ClientsContext';
import { upsertClientDoc, deleteClientDoc } from '@/src/lib/firestoreService';

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
    await upsertClientDoc('clients', client.id, client);
  }

  async function remove(id: string): Promise<void> {
    await deleteClientDoc('clients', id);
  }

  return { upsert, remove };
}
