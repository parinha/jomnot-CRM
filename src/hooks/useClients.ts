import { useSWRConfig } from 'swr';
import { ApiError } from '@/src/lib/swr-fetcher';
import type { Client } from '@/src/types';
import { useClientsContext } from '@/src/contexts/ClientsContext';

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
  const { mutate } = useSWRConfig();

  async function upsert(client: Client): Promise<void> {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save client', res.status);
    }
    await mutate('/api/clients');
  }

  async function remove(id: string): Promise<void> {
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to delete client', res.status);
    }
    await mutate('/api/clients');
  }

  return { upsert, remove };
}
