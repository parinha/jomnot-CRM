import type { Quotation } from '@/src/types';
import { useQuotationsContext } from '@/src/contexts/QuotationsContext';
import { upsertDoc, deleteDoc } from '@/src/lib/client/firestore';

export function useQuotations() {
  const { quotations, loading } = useQuotationsContext();
  return { data: quotations, isLoading: loading };
}

export function useQuotationMutations() {
  async function upsert(quote: Quotation): Promise<void> {
    await upsertDoc('quotations', quote.id, { ...quote, updatedAt: new Date().toISOString() });
  }

  async function remove(id: string): Promise<void> {
    await deleteDoc('quotations', id);
  }

  return { upsert, remove };
}
