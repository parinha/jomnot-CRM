import { cache } from 'react';
import { adminDb } from '@/src/lib/firebase-admin';
import type { Client } from '@/src/types';

export const getClients = cache(async function getClients(): Promise<Client[]> {
  const snap = await adminDb.collection('clients').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Client);
});
