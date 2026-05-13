import type { Invoice, InvoiceStatus } from '@/src/types';
import { useInvoicesContext } from '@/src/contexts/InvoicesContext';
import { upsertClientDoc, deleteClientDoc, patchClientDoc } from '@/src/lib/firestoreService';

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
  async function upsert(invoice: Invoice): Promise<void> {
    await upsertClientDoc('invoices', invoice.id, invoice);
  }

  async function remove(id: string): Promise<void> {
    await deleteClientDoc('invoices', id);
  }

  async function updateStatus(id: string, status: InvoiceStatus): Promise<void> {
    await patchClientDoc('invoices', id, { status });
  }

  return { upsert, remove, updateStatus };
}
