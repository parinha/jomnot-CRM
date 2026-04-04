import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/_lib/firebase';
import type { Project } from '@/app/dashboard/AppStore';

export async function getProjects(): Promise<Project[]> {
  const snap = await getDocs(collection(db, 'projects'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
}
