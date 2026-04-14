'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/src/lib/firebase-admin';
import type { Client } from '@/src/types';

const now = () => new Date().toISOString();

export async function upsertClient(client: Client): Promise<void> {
  const ref = adminDb.collection('clients').doc(client.id);
  const snap = await ref.get();
  const ts = now();

  const data = Object.fromEntries(
    Object.entries({
      ...client,
      ...(snap.exists ? { updatedAt: ts } : { createdAt: client.createdAt ?? ts, updatedAt: ts }),
    }).filter(([, v]) => v !== undefined)
  );

  await ref.set(data);
  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard');
}

export async function deleteClient(id: string): Promise<void> {
  await adminDb.collection('clients').doc(id).delete();
  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard');
}
