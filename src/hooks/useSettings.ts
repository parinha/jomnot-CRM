import { useSettingsContext } from '@/src/contexts/SettingsContext';
import type {
  AppPreferences,
  CompanyProfile,
  InvoicingSettings,
  PaymentInfo,
  PaymentMethod,
  QuotationSettings,
} from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import { setDocPath, mergeDocPath } from '@/src/lib/client/firestore';

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

export function usePaymentMethods() {
  const { paymentMethods, loading } = useSettingsContext();
  return {
    data: paymentMethods,
    isLoading: loading,
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

export function useQuotationSettings() {
  const { quotationSettings, loading } = useSettingsContext();
  return { data: quotationSettings, isLoading: loading };
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
  async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
    await setDocPath('settings/company', profile as unknown as Record<string, unknown>);
  }

  async function savePaymentInfo(payment: PaymentInfo): Promise<void> {
    const telegramFields: Record<string, unknown> = {
      telegramBotToken: payment.telegramBotToken,
      telegramChatId: payment.telegramChatId,
      telegramTopicId: payment.telegramTopicId,
      telegramQuoteChatId: payment.telegramQuoteChatId,
      telegramQuoteTopicId: payment.telegramQuoteTopicId,
      telegramReceiptChatId: payment.telegramReceiptChatId,
      telegramReceiptTopicId: payment.telegramReceiptTopicId,
    };
    await mergeDocPath(
      'settings/preferences',
      Object.fromEntries(Object.entries(telegramFields).filter(([, v]) => v !== undefined))
    );
  }

  async function saveInvoicingSettings(invoicing: InvoicingSettings): Promise<void> {
    await setDocPath('settings/invoicing', invoicing as unknown as Record<string, unknown>);
  }

  async function saveScopeOfWork(items: string[]): Promise<void> {
    await setDocPath('settings/scopes', { items });
  }

  async function saveAppPreferences(prefs: AppPreferences): Promise<void> {
    await mergeDocPath('settings/preferences', {
      holidays: prefs.holidays,
    });
  }

  async function saveQuotationSettings(settings: QuotationSettings): Promise<void> {
    await setDocPath('settings/quotation', settings as unknown as Record<string, unknown>);
  }

  async function savePaymentMethods(methods: PaymentMethod[]): Promise<void> {
    await setDocPath('settings/paymentMethods', { methods });
  }

  return {
    saveCompanyProfile,
    savePaymentInfo,
    saveInvoicingSettings,
    saveScopeOfWork,
    saveAppPreferences,
    savePaymentMethods,
    saveQuotationSettings,
  };
}
