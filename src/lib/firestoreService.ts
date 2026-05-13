'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  setDoc,
  updateDoc,
  deleteDoc as fsDeleteDoc,
} from 'firebase/firestore';
import { db } from './firebase-client';

type HasId = { id: string };

export async function fetchDoc<T>(collectionName: string, docId: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, docId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

export async function fetchAll<T>(collectionName: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function fetchDocPath<T>(docPath: string): Promise<T | null> {
  const snap = await getDoc(doc(db, docPath));
  return snap.exists() ? (snap.data() as T) : null;
}

export async function upsertClientDoc<T extends object>(
  collectionName: string,
  docId: string,
  data: T
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(([, v]) => v !== undefined)
  );
  await setDoc(doc(db, collectionName, docId), clean);
}

export async function deleteClientDoc(collectionName: string, docId: string): Promise<void> {
  await fsDeleteDoc(doc(db, collectionName, docId));
}

export async function patchClientDoc(
  collectionName: string,
  docId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, collectionName, docId), {
    ...fields,
    updatedAt: new Date().toISOString(),
  });
}

export async function setDocPath(docPath: string, data: Record<string, unknown>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, updatedAt: new Date().toISOString() }).filter(
      ([, v]) => v !== undefined
    )
  );
  await setDoc(doc(db, docPath), clean);
}

export async function mergeDocPath(docPath: string, data: Record<string, unknown>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, updatedAt: new Date().toISOString() }).filter(
      ([, v]) => v !== undefined
    )
  );
  await setDoc(doc(db, docPath), clean, { merge: true });
}

export async function replaceAll<T extends HasId>(
  collectionName: string,
  oldItems: T[],
  newItems: T[]
): Promise<void> {
  const newById = new Map(newItems.map((i) => [i.id, i]));
  const oldById = new Map(oldItems.map((i) => [i.id, i]));

  const toDelete = oldItems.filter((i) => !newById.has(i.id));
  const toUpsert = newItems.filter((i) => {
    const o = oldById.get(i.id);
    return !o || JSON.stringify(o) !== JSON.stringify(i);
  });

  if (toDelete.length === 0 && toUpsert.length === 0) return;

  const batch = writeBatch(db);
  for (const item of toDelete) {
    batch.delete(doc(db, collectionName, item.id));
  }
  for (const item of toUpsert) {
    const data = Object.fromEntries(
      Object.entries(item as Record<string, unknown>).filter(([, v]) => v !== undefined)
    );
    batch.set(doc(db, collectionName, item.id), data);
  }
  await batch.commit();
}
