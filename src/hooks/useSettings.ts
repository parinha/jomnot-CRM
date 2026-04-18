import useSWR, { useSWRConfig } from 'swr';
import { fetcher, ApiError } from '@/src/lib/swr-fetcher';
import type { AppPreferences, CompanyProfile, PaymentInfo } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import { DEFAULT_SCOPES } from '@/src/config/constants';

const profileFetcher = fetcher as (url: string) => Promise<CompanyProfile>;
const paymentFetcher = fetcher as (url: string) => Promise<PaymentInfo>;
const scopesFetcher = fetcher as (url: string) => Promise<string[]>;

export function useCompanyProfile() {
  const { data, error, isLoading, mutate } = useSWR<CompanyProfile>(
    '/api/settings/company',
    profileFetcher
  );
  return { data: data ?? null, isLoading, isError: !!error, error, mutate };
}

export function usePaymentInfo() {
  const { data, error, isLoading, mutate } = useSWR<PaymentInfo>(
    '/api/settings/payment',
    paymentFetcher
  );
  return { data: data ?? null, isLoading, isError: !!error, error, mutate };
}

export function useScopeOfWork() {
  const { data, error, isLoading, mutate } = useSWR<string[]>(
    '/api/settings/scopes',
    scopesFetcher
  );
  return { data: data ?? DEFAULT_SCOPES, isLoading, isError: !!error, error, mutate };
}

export function useSettingsMutations() {
  const { mutate } = useSWRConfig();

  async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
    const res = await fetch('/api/settings/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save company profile', res.status);
    }
    await mutate('/api/settings/company');
  }

  async function savePaymentInfo(payment: PaymentInfo): Promise<void> {
    const res = await fetch('/api/settings/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save payment info', res.status);
    }
    await mutate('/api/settings/payment');
  }

  async function saveScopeOfWork(items: string[]): Promise<void> {
    const res = await fetch('/api/settings/scopes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save scope of work', res.status);
    }
    await mutate('/api/settings/scopes');
  }

  async function saveAppPreferences(prefs: AppPreferences): Promise<void> {
    const res = await fetch('/api/settings/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save preferences', res.status);
    }
    await mutate('/api/settings/preferences');
  }

  return { saveCompanyProfile, savePaymentInfo, saveScopeOfWork, saveAppPreferences };
}

export function useAppPreferences() {
  const { data, error, isLoading, mutate } = useSWR<AppPreferences>(
    '/api/settings/preferences',
    fetcher as (url: string) => Promise<AppPreferences>
  );
  return {
    data: data ? { ...DEFAULT_APP_PREFERENCES, ...data } : DEFAULT_APP_PREFERENCES,
    isLoading,
    isError: !!error,
    mutate,
  };
}
