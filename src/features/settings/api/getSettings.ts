import { cache } from 'react';
import { adminDb } from '@/src/lib/firebase-admin';
import type { AppPreferences, CompanyProfile, InvoicingSettings, PaymentInfo } from '@/src/types';
import { DEFAULT_APP_PREFERENCES, DEFAULT_INVOICING_SETTINGS } from '@/src/types';
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
    const snap = await adminDb.doc('settings/preferences').get();
    return snap.exists
      ? { ...EMPTY_PAYMENT, ...(snap.data() as Partial<PaymentInfo>) }
      : EMPTY_PAYMENT;
  } catch {
    return EMPTY_PAYMENT;
  }
});

export const getInvoicingSettings = cache(
  async function getInvoicingSettings(): Promise<InvoicingSettings> {
    try {
      const snap = await adminDb.doc('settings/invoicing').get();
      return snap.exists
        ? { ...DEFAULT_INVOICING_SETTINGS, ...(snap.data() as Partial<InvoicingSettings>) }
        : DEFAULT_INVOICING_SETTINGS;
    } catch {
      return DEFAULT_INVOICING_SETTINGS;
    }
  }
);

export const getScopeOfWork = cache(async function getScopeOfWork(): Promise<string[]> {
  try {
    const snap = await adminDb.doc('settings/scopes').get();
    if (snap.exists) return (snap.data()?.items as string[]) ?? DEFAULT_SCOPES;
    return DEFAULT_SCOPES;
  } catch {
    return DEFAULT_SCOPES;
  }
});

// Returns full AppPreferences (with currency/tax/dateFormat) by merging from:
//   settings/preferences (kanbanPhases, holidays) + settings/invoicing (currency, date, tax)
// This keeps AppPreferencesContext working without changes across the app.
export const getAppPreferences = cache(async function getAppPreferences(): Promise<AppPreferences> {
  try {
    const [prefsSnap, invSnap] = await Promise.all([
      adminDb.doc('settings/preferences').get(),
      adminDb.doc('settings/invoicing').get(),
    ]);
    const workspace = prefsSnap.exists ? (prefsSnap.data() as Partial<AppPreferences>) : {};
    const invoicing = invSnap.exists ? (invSnap.data() as Partial<InvoicingSettings>) : {};

    return {
      ...DEFAULT_APP_PREFERENCES,
      ...workspace,
      // Overlay invoicing-sourced display fields so the context stays current
      currencyCode:
        invoicing.currencyCode ?? workspace.currencyCode ?? DEFAULT_APP_PREFERENCES.currencyCode,
      currencySymbol:
        invoicing.currencySymbol ??
        workspace.currencySymbol ??
        DEFAULT_APP_PREFERENCES.currencySymbol,
      dateFormat:
        invoicing.dateFormat ?? workspace.dateFormat ?? DEFAULT_APP_PREFERENCES.dateFormat,
      taxEnabled:
        invoicing.taxEnabled ?? workspace.taxEnabled ?? DEFAULT_APP_PREFERENCES.taxEnabled,
      taxLabel: invoicing.taxLabel ?? workspace.taxLabel ?? DEFAULT_APP_PREFERENCES.taxLabel,
      taxRate: invoicing.taxRate ?? workspace.taxRate ?? DEFAULT_APP_PREFERENCES.taxRate,
      taxType: invoicing.taxType ?? workspace.taxType ?? DEFAULT_APP_PREFERENCES.taxType,
    };
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
});
