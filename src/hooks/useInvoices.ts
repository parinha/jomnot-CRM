import { useSWRConfig } from 'swr';
import { ApiError } from '@/src/lib/swr-fetcher';
import type { Invoice, InvoiceStatus } from '@/src/types';
import { useInvoicesContext } from '@/src/contexts/InvoicesContext';

export function useInvoices() {
  const { invoices, loading } = useInvoicesContext();
  return {
    data: invoices,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useInvoice(id: string | null) {
  const { invoices, loading } = useInvoicesContext();
  const data = id ? (invoices.find((i) => i.id === id) ?? null) : null;
  return {
    data,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useInvoiceMutations() {
  const { mutate } = useSWRConfig();

  async function upsert(invoice: Invoice): Promise<void> {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save invoice', res.status);
    }
    await mutate('/api/invoices');
  }

  async function remove(id: string): Promise<void> {
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to delete invoice', res.status);
    }
    await mutate('/api/invoices');
  }

  async function updateStatus(id: string, status: InvoiceStatus): Promise<void> {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to update invoice status', res.status);
    }
    await mutate('/api/invoices');
  }

  return { upsert, remove, updateStatus };
}
