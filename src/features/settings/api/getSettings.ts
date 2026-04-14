import { adminDb } from '@/src/lib/firebase-admin';
import type { CompanyProfile, PaymentInfo } from '@/src/types';
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

export async function getCompanyProfile(): Promise<CompanyProfile> {
  try {
    const snap = await adminDb.doc('settings/company').get();
    return snap.exists ? (snap.data() as CompanyProfile) : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function getPaymentInfo(): Promise<PaymentInfo> {
  try {
    const snap = await adminDb.doc('settings/payment').get();
    return snap.exists ? (snap.data() as PaymentInfo) : EMPTY_PAYMENT;
  } catch {
    return EMPTY_PAYMENT;
  }
}

export async function getScopeOfWork(): Promise<string[]> {
  try {
    const snap = await adminDb.doc('settings/scopes').get();
    if (snap.exists) return (snap.data()?.items as string[]) ?? DEFAULT_SCOPES;
    return DEFAULT_SCOPES;
  } catch {
    return DEFAULT_SCOPES;
  }
}
