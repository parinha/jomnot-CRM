/**
 * Firestore (Admin SDK) write helpers for API route handlers.
 * Never import this from client components or hooks.
 */

import { adminDb } from '../firebase-admin';

const now = () => new Date().toISOString();

type PlainObject = Record<string, unknown>;

/** Upsert a document. Returns whether it was newly created. */
export async function upsertDoc(
  collection: string,
  id: string,
  data: PlainObject
): Promise<{ isNew: boolean }> {
  const ref = adminDb.collection(collection).doc(id);
  const snap = await ref.get();
  const ts = now();

  const payload = Object.fromEntries(
    Object.entries({
      ...data,
      ...(snap.exists
        ? { updatedAt: ts }
        : { createdAt: (data.createdAt as string) ?? ts, updatedAt: ts }),
    }).filter(([, v]) => v !== undefined)
  );

  await ref.set(payload);
  return { isNew: !snap.exists };
}

/** Delete a document. */
export async function deleteDoc(collection: string, id: string): Promise<void> {
  await adminDb.collection(collection).doc(id).delete();
}

/** Partial-update specific fields on a document. Always stamps updatedAt. */
export async function patchDoc(collection: string, id: string, fields: PlainObject): Promise<void> {
  await adminDb
    .collection(collection)
    .doc(id)
    .update({ ...fields, updatedAt: now() });
}

/** Overwrite a document at an explicit path (e.g. settings/company). */
export async function setDocPath(docPath: string, data: PlainObject): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, updatedAt: now() }).filter(([, v]) => v !== undefined)
  );
  await adminDb.doc(docPath).set(clean);
}

/** Merge specific fields into a document without touching other fields. */
export async function mergeDocPath(docPath: string, data: PlainObject): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, updatedAt: now() }).filter(([, v]) => v !== undefined)
  );
  await adminDb.doc(docPath).set(clean, { merge: true });
}
