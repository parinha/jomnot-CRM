'use client';

import { fmtCurrency, fmtShortCurrency, fmtDate } from '@/src/lib/formatters';
import { useSettingsContext } from './SettingsContext';
import type { AppPreferences } from '@/src/types';

export function useAppPreferences(): AppPreferences {
  return useSettingsContext().appPreferences;
}

export function useCurrency() {
  const prefs = useAppPreferences();
  return {
    fmtAmount: (n: number) => fmtCurrency(n, prefs.currencyCode),
    fmtShort: (n: number) => fmtShortCurrency(n, prefs.currencyCode, prefs.currencySymbol),
  };
}

export function useDateFmt() {
  const prefs = useAppPreferences();
  return (s: string | undefined | null) => fmtDate(s, prefs.dateFormat);
}
