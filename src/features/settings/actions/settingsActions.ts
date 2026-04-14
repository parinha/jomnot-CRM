'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/src/lib/firebase-admin';
import type { CompanyProfile, PaymentInfo } from '@/src/types';

const now = () => new Date().toISOString();

export async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
  await adminDb.doc('settings/company').set({ ...profile, updatedAt: now() });
  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard', 'layout');
}

export async function savePaymentInfo(payment: PaymentInfo): Promise<void> {
  await adminDb.doc('settings/payment').set({ ...payment, updatedAt: now() });
  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard', 'layout');
}

export async function saveScopeOfWork(items: string[]): Promise<void> {
  await adminDb.doc('settings/scopes').set({ items, updatedAt: now() });
  revalidatePath('/dashboard/settings');
}
