import type { Invoice, AppPreferences } from '@/src/types';

export const WHT_RATE = 0.15;

export interface TaxConfig {
  enabled: boolean;
  label: string;
  rate: number; // e.g. 15 for 15%
  type: 'additive' | 'deductive';
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  enabled: false,
  label: 'Tax',
  rate: 0,
  type: 'additive',
};

export function taxConfigFromPrefs(
  prefs: Pick<AppPreferences, 'taxEnabled' | 'taxLabel' | 'taxRate' | 'taxType'>
): TaxConfig {
  return {
    enabled: prefs.taxEnabled,
    label: prefs.taxLabel,
    rate: prefs.taxRate,
    type: prefs.taxType,
  };
}

export function calcSubtotal(inv: Invoice): number {
  return inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
}

/**
 * Net amount the freelancer actually receives.
 * - Deductive (WHT-style): gross × (1 − rate%)
 * - Additive (VAT-style): gross (tax is added on top, not subtracted from payout)
 * Falls back to legacy withWHT flag if no taxConfig is passed.
 */
export function calcNet(inv: Invoice, tax?: TaxConfig): number {
  const gross = calcSubtotal(inv);
  if (tax?.enabled && inv.withWHT && tax.type === 'deductive') {
    return gross * (1 - tax.rate / 100);
  }
  if (!tax && inv.withWHT) {
    return gross * (1 - WHT_RATE);
  }
  return gross;
}

/**
 * Tax amount line (shown on invoice).
 * Returns null if tax not applicable.
 */
export function calcTaxAmount(inv: Invoice, tax?: TaxConfig): number | null {
  const gross = calcSubtotal(inv);
  if (tax?.enabled && inv.withWHT) {
    return gross * (tax.rate / 100);
  }
  if (!tax && inv.withWHT) {
    return gross * WHT_RATE;
  }
  return null;
}

export function calcEarned(inv: Invoice, tax?: TaxConfig): number {
  const net = calcNet(inv, tax);
  if (inv.status === 'paid') return net;
  if (inv.status === 'partial') return net * ((inv.depositPercent ?? 0) / 100);
  return 0;
}

export function calcBalance(inv: Invoice, tax?: TaxConfig): number {
  return calcNet(inv, tax) - calcEarned(inv, tax);
}
