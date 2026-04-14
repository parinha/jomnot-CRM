'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/src/lib/firebase-admin';
import type { Project, ProjectItem } from '@/src/types';
import { sendNewProjectTelegram } from '@/src/features/dashboard/actions/telegramActions';

const now = () => new Date().toISOString();

const REVALIDATE_PATHS = [
  '/dashboard/projects',
  '/dashboard/kanban',
  '/dashboard/timeline',
  '/dashboard',
];

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

export async function upsertProject(project: Project): Promise<void> {
  const ref = adminDb.collection('projects').doc(project.id);
  const snap = await ref.get();
  const ts = now();

  const data = Object.fromEntries(
    Object.entries({
      ...project,
      ...(snap.exists ? { updatedAt: ts } : { createdAt: project.createdAt ?? ts, updatedAt: ts }),
    }).filter(([, v]) => v !== undefined)
  );

  const isNew = !snap.exists;
  await ref.set(data);
  revalidateAll();
  if (isNew) void sendNewProjectTelegram(project);
}

export async function deleteProject(id: string): Promise<void> {
  await adminDb.collection('projects').doc(id).delete();
  revalidateAll();
}

export async function updateProjectItems(projectId: string, items: ProjectItem[]): Promise<void> {
  await adminDb.collection('projects').doc(projectId).update({ items, updatedAt: now() });
  revalidateAll();
}
