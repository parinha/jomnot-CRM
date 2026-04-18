import { cache } from 'react';
import { adminDb } from '@/src/lib/firebase-admin';
import type { AppPreferences, CompanyProfile, PaymentInfo } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import { DEFAULT_SCOPES } from '@/src/config/constants';

const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  logo: '',
  address: '',
  phone: '',
  website: '',
  signatoryName: '',
  signatorySignature: '',
};
const EMPTY_PAYMENT: PaymentInfo = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  swiftCode: '',
  currency: '',
  qrImage: '',
};

export const getCompanyProfile = cache(async function getCompanyProfile(): Promise<CompanyProfile> {
  try {
    const snap = await adminDb.doc('settings/company').get();
    return snap.exists ? (snap.data() as CompanyProfile) : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
});

export const getPaymentInfo = cache(async function getPaymentInfo(): Promise<PaymentInfo> {
  try {
    const snap = await adminDb.doc('settings/payment').get();
    return snap.exists ? (snap.data() as PaymentInfo) : EMPTY_PAYMENT;
  } catch {
    return EMPTY_PAYMENT;
  }
});

export const getScopeOfWork = cache(async function getScopeOfWork(): Promise<string[]> {
  try {
    const snap = await adminDb.doc('settings/scopes').get();
    if (snap.exists) return (snap.data()?.items as string[]) ?? DEFAULT_SCOPES;
    return DEFAULT_SCOPES;
  } catch {
    return DEFAULT_SCOPES;
  }
});

export const getAppPreferences = cache(async function getAppPreferences(): Promise<AppPreferences> {
  try {
    const snap = await adminDb.doc('settings/preferences').get();
    return snap.exists
      ? { ...DEFAULT_APP_PREFERENCES, ...(snap.data() as AppPreferences) }
      : DEFAULT_APP_PREFERENCES;
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
});
