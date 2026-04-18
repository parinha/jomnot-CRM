'use client';

import { createContext, useContext } from 'react';
import type { AppPreferences } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import { fmtCurrency, fmtShortCurrency, fmtDate } from '@/src/lib/formatters';

export const AppPreferencesContext = createContext<AppPreferences>(DEFAULT_APP_PREFERENCES);

export function useAppPreferences(): AppPreferences {
  return useContext(AppPreferencesContext);
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
