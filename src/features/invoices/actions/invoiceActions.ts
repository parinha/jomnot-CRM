'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/src/lib/firebase-admin';
import type { Invoice, InvoiceStatus } from '@/src/types';

const now = () => new Date().toISOString();

const REVALIDATE_PATHS = [
  '/dashboard/invoices',
  '/dashboard/payments',
  '/dashboard/reports',
  '/dashboard',
];

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

export async function upsertInvoice(invoice: Invoice): Promise<void> {
  const ref = adminDb.collection('invoices').doc(invoice.id);
  const snap = await ref.get();
  const ts = now();

  const data = Object.fromEntries(
    Object.entries({
      ...invoice,
      ...(snap.exists ? { updatedAt: ts } : { createdAt: invoice.createdAt ?? ts, updatedAt: ts }),
    }).filter(([, v]) => v !== undefined)
  );

  await ref.set(data);
  revalidateAll();
}

export async function deleteInvoice(id: string): Promise<void> {
  await adminDb.collection('invoices').doc(id).delete();
  revalidateAll();
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  await adminDb.collection('invoices').doc(id).update({ status, updatedAt: now() });
  revalidateAll();
}
