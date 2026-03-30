import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/app/_lib/firebase'
import { DEFAULT_SCOPES } from '@/app/_config/constants'

export async function getScopes(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'scopes'))
    return snap.exists() ? ((snap.data().items as string[]) ?? DEFAULT_SCOPES) : DEFAULT_SCOPES
  } catch {
    return DEFAULT_SCOPES
  }
}
