import { storageGet, storageSet } from '@/app/_lib/storage'
import { STORAGE_KEYS } from '@/app/_config/constants'
import type { Invoice } from '@/app/dashboard/AppStore'

export function getInvoices(): Invoice[] {
  return storageGet<Invoice[]>(STORAGE_KEYS.invoices, [])
}

export function saveInvoices(invoices: Invoice[]): void {
  storageSet(STORAGE_KEYS.invoices, invoices)
}

/** Net line-item total. */
export function calcSubtotal(inv: Invoice): number {
  return inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
}

/** Total the client pays (same as subtotal — no WHT). */
export function calcInvoiceTotal(inv: Invoice): number {
  return calcSubtotal(inv)
}

/**
 * Cash actually received by the freelancer for this invoice.
 * - paid    → full subtotal
 * - partial → deposit portion of subtotal (depositPercent%)
 * - all others → 0
 */
export function calcEarned(inv: Invoice): number {
  const sub = calcSubtotal(inv)
  if (inv.status === 'paid') return sub
  if (inv.status === 'partial') return sub * ((inv.depositPercent ?? 0) / 100)
  return 0
}

/**
 * Amount the freelancer still expects to receive.
 */
export function calcBalance(inv: Invoice): number {
  return calcSubtotal(inv) - calcEarned(inv)
}
