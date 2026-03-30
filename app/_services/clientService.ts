import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/app/_lib/firebase'
import type { Client } from '@/app/dashboard/AppStore'

export async function getClients(): Promise<Client[]> {
  const snap = await getDocs(collection(db, 'clients'))
  return snap.docs.map((d) => d.data() as Client)
}
