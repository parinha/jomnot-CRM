import useSWR, { useSWRConfig } from 'swr';
import { fetcher, ApiError } from '@/src/lib/swr-fetcher';
import type { Invoice, InvoiceStatus } from '@/src/types';

const invoiceFetcher = fetcher as (url: string) => Promise<Invoice[]>;
const singleFetcher = fetcher as (url: string) => Promise<Invoice>;

export function useInvoices() {
  const { data, error, isLoading, mutate } = useSWR<Invoice[]>('/api/invoices', invoiceFetcher);
  return {
    data: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useInvoice(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Invoice>(
    id ? `/api/invoices/${id}` : null,
    singleFetcher
  );
  return {
    data: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
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
