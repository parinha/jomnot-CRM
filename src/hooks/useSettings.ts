import { useSettingsContext } from '@/src/contexts/SettingsContext';
import type { AppPreferences, CompanyProfile, InvoicingSettings, PaymentInfo } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';

export function useCompanyProfile() {
  const { companyProfile, loading } = useSettingsContext();
  return {
    data: companyProfile as CompanyProfile | null,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function usePaymentInfo() {
  const { paymentInfo, loading } = useSettingsContext();
  return {
    data: paymentInfo as PaymentInfo | null,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useInvoicingSettings() {
  const { invoicingSettings, loading } = useSettingsContext();
  return {
    data: invoicingSettings,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useScopeOfWork() {
  const { scopeOfWork, loading } = useSettingsContext();
  return {
    data: scopeOfWork,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useAppPreferences() {
  const { appPreferences, loading } = useSettingsContext();
  return {
    data: { ...DEFAULT_APP_PREFERENCES, ...appPreferences } as AppPreferences,
    isLoading: loading,
    isError: false,
    mutate: async () => {},
  };
}

export function useSettingsMutations() {
  const {
    saveCompanyProfile,
    savePaymentInfo,
    saveScopeOfWork,
    saveAppPreferences,
    saveInvoicingSettings,
  } = useSettingsContext();

  async function saveCompanyProfileWrapped(profile: CompanyProfile): Promise<void> {
    await saveCompanyProfile(profile);
  }

  async function savePaymentInfoWrapped(payment: PaymentInfo): Promise<void> {
    await savePaymentInfo(payment);
  }

  async function saveScopeOfWorkWrapped(items: string[]): Promise<void> {
    await saveScopeOfWork(items);
  }

  async function saveAppPreferencesWrapped(prefs: AppPreferences): Promise<void> {
    await saveAppPreferences(prefs);
  }

  async function saveInvoicingSettingsWrapped(invoicing: InvoicingSettings): Promise<void> {
    await saveInvoicingSettings(invoicing);
  }

  return {
    saveCompanyProfile: saveCompanyProfileWrapped,
    savePaymentInfo: savePaymentInfoWrapped,
    saveScopeOfWork: saveScopeOfWorkWrapped,
    saveAppPreferences: saveAppPreferencesWrapped,
    saveInvoicingSettings: saveInvoicingSettingsWrapped,
  };
}
