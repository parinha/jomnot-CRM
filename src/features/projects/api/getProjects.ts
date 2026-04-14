import { adminDb } from '@/src/lib/firebase-admin';
import type { Project } from '@/src/types';

export async function getProjects(): Promise<Project[]> {
  const snap = await adminDb.collection('projects').get();
  return snap.docs.map((d) => {
    const data = { id: d.id, ...d.data() } as Project;
    // migrate legacy statuses
    const s = data.status as string;
    if (s === 'draft') data.status = 'unconfirmed';
    else if (s === 'in-progress') data.status = 'confirmed';
    return data;
  });
}
