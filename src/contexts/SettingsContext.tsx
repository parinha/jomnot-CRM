'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase-client';
import { setDocPath, mergeDocPath } from '@/src/lib/firestoreService';
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

function buildAppPreferences(
  prefs: Record<string, unknown>,
  invoicing: Partial<InvoicingSettings>
): AppPreferences {
  const p = prefs as Partial<AppPreferences>;
  return {
    ...DEFAULT_APP_PREFERENCES,
    kanbanPhases: p.kanbanPhases ?? DEFAULT_APP_PREFERENCES.kanbanPhases,
    holidays: p.holidays ?? DEFAULT_APP_PREFERENCES.holidays,
    currencyCode: invoicing.currencyCode ?? p.currencyCode ?? DEFAULT_APP_PREFERENCES.currencyCode,
    currencySymbol:
      invoicing.currencySymbol ?? p.currencySymbol ?? DEFAULT_APP_PREFERENCES.currencySymbol,
    dateFormat: invoicing.dateFormat ?? p.dateFormat ?? DEFAULT_APP_PREFERENCES.dateFormat,
    taxEnabled: invoicing.taxEnabled ?? p.taxEnabled ?? DEFAULT_APP_PREFERENCES.taxEnabled,
    taxLabel: invoicing.taxLabel ?? p.taxLabel ?? DEFAULT_APP_PREFERENCES.taxLabel,
    taxRate: invoicing.taxRate ?? p.taxRate ?? DEFAULT_APP_PREFERENCES.taxRate,
    taxType: invoicing.taxType ?? p.taxType ?? DEFAULT_APP_PREFERENCES.taxType,
  };
}

interface SettingsCtx {
  companyProfile: CompanyProfile;
  paymentInfo: PaymentInfo;
  invoicingSettings: InvoicingSettings;
  scopeOfWork: string[];
  appPreferences: AppPreferences;
  loading: boolean;
  saveCompanyProfile(p: CompanyProfile): Promise<void>;
  savePaymentInfo(p: PaymentInfo): Promise<void>;
  saveInvoicingSettings(s: InvoicingSettings): Promise<void>;
  saveScopeOfWork(items: string[]): Promise<void>;
  saveAppPreferences(p: AppPreferences): Promise<void>;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [invoicingSettings, setInvoicingSettings] = useState<InvoicingSettings>(
    DEFAULT_INVOICING_SETTINGS
  );
  const [scopeOfWork, setScopeOfWork] = useState<string[]>(DEFAULT_SCOPES);
  const [prefsRaw, setPrefsRaw] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ready = new Set<string>();
    const markReady = (key: string) => {
      ready.add(key);
      if (ready.size >= 4) setLoading(false);
    };

    const u1 = onSnapshot(
      doc(db, 'settings', 'company'),
      (snap) => {
        if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile);
        markReady('company');
      },
      () => markReady('company')
    );

    const u2 = onSnapshot(
      doc(db, 'settings', 'preferences'),
      (snap) => {
        if (snap.exists()) setPrefsRaw(snap.data() as Record<string, unknown>);
        markReady('preferences');
      },
      () => markReady('preferences')
    );

    const u3 = onSnapshot(
      doc(db, 'settings', 'invoicing'),
      (snap) => {
        if (snap.exists())
          setInvoicingSettings({
            ...DEFAULT_INVOICING_SETTINGS,
            ...(snap.data() as Partial<InvoicingSettings>),
          });
        markReady('invoicing');
      },
      () => markReady('invoicing')
    );

    const u4 = onSnapshot(
      doc(db, 'settings', 'scopes'),
      (snap) => {
        if (snap.exists()) setScopeOfWork((snap.data()?.items as string[]) ?? DEFAULT_SCOPES);
        markReady('scopes');
      },
      () => markReady('scopes')
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const paymentInfo: PaymentInfo = {
    ...EMPTY_PAYMENT,
    ...(prefsRaw as Partial<PaymentInfo>),
  };

  const appPreferences = buildAppPreferences(prefsRaw, invoicingSettings);

  async function saveCompanyProfile(p: CompanyProfile): Promise<void> {
    await setDocPath('settings/company', p as unknown as Record<string, unknown>);
  }

  async function savePaymentInfo(p: PaymentInfo): Promise<void> {
    const telegramFields: Record<string, unknown> = {
      telegramBotToken: p.telegramBotToken,
      telegramChatId: p.telegramChatId,
      telegramTopicId: p.telegramTopicId,
      projectTelegramChatId: p.projectTelegramChatId,
      projectTelegramTopicId: p.projectTelegramTopicId,
      kanbanUpdateEnabled: p.kanbanUpdateEnabled,
      kanbanUpdateTimes: p.kanbanUpdateTimes,
      kanbanUpdateDays: p.kanbanUpdateDays,
      kanbanUpdateTimezone: p.kanbanUpdateTimezone,
      telegramTemplate: p.telegramTemplate,
    };
    await mergeDocPath(
      'settings/preferences',
      Object.fromEntries(Object.entries(telegramFields).filter(([, v]) => v !== undefined))
    );
  }

  async function saveInvoicingSettings(s: InvoicingSettings): Promise<void> {
    await setDocPath('settings/invoicing', s as unknown as Record<string, unknown>);
  }

  async function saveScopeOfWork(items: string[]): Promise<void> {
    await setDocPath('settings/scopes', { items });
  }

  async function saveAppPreferences(p: AppPreferences): Promise<void> {
    await mergeDocPath('settings/preferences', {
      kanbanPhases: p.kanbanPhases,
      holidays: p.holidays,
    });
  }

  return (
    <Ctx.Provider
      value={{
        companyProfile,
        paymentInfo,
        invoicingSettings,
        scopeOfWork,
        appPreferences,
        loading,
        saveCompanyProfile,
        savePaymentInfo,
        saveInvoicingSettings,
        saveScopeOfWork,
        saveAppPreferences,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSettingsContext(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider');
  return ctx;
}
