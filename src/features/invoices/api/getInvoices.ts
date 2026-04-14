import { cache } from 'react';
import { adminDb } from '@/src/lib/firebase-admin';
import type { Invoice } from '@/src/types';

export const getInvoices = cache(async function getInvoices(): Promise<Invoice[]> {
  const snap = await adminDb.collection('invoices').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice);
});

export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await adminDb.collection('invoices').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Invoice;
}
