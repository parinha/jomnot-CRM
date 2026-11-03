import type { Receipt } from '@/src/types';
import { useReceiptsContext } from '@/src/contexts/ReceiptsContext';
import { upsertDoc, deleteDoc } from '@/src/lib/client/firestore';

export function useReceipts() {
  const { receipts, loading } = useReceiptsContext();
  return { data: receipts, isLoading: loading };
}

export function useReceiptMutations() {
  async function upsert(receipt: Receipt): Promise<void> {
    await upsertDoc('receipts', receipt.id, { ...receipt, updatedAt: new Date().toISOString() });
  }
  async function remove(id: string): Promise<void> {
    await deleteDoc('receipts', id);
  }
  return { upsert, remove };
}
