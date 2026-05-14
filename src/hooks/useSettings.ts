import { useSettingsContext } from '@/src/contexts/SettingsContext';
import type { AppPreferences, CompanyProfile, InvoicingSettings, PaymentInfo } from '@/src/types';
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
  async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
    await setDocPath('settings/company', profile as unknown as Record<string, unknown>);
  }

  async function savePaymentInfo(payment: PaymentInfo): Promise<void> {
    const telegramFields: Record<string, unknown> = {
      telegramBotToken: payment.telegramBotToken,
      telegramChatId: payment.telegramChatId,
      telegramTopicId: payment.telegramTopicId,
      projectTelegramChatId: payment.projectTelegramChatId,
      projectTelegramTopicId: payment.projectTelegramTopicId,
      kanbanUpdateEnabled: payment.kanbanUpdateEnabled,
      kanbanUpdateTimes: payment.kanbanUpdateTimes,
      kanbanUpdateDays: payment.kanbanUpdateDays,
      kanbanUpdateTimezone: payment.kanbanUpdateTimezone,
      telegramTemplate: payment.telegramTemplate,
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
      kanbanPhases: prefs.kanbanPhases,
      holidays: prefs.holidays,
    });
  }

  return {
    saveCompanyProfile,
    savePaymentInfo,
    saveInvoicingSettings,
    saveScopeOfWork,
    saveAppPreferences,
  };
}
