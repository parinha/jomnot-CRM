import { storageGet, storageSet } from '@/app/_lib/storage'
import { STORAGE_KEYS, WHT_RATE } from '@/app/_config/constants'
import type { Invoice } from '@/app/dashboard/AppStore'

export function getInvoices(): Invoice[] {
  return storageGet<Invoice[]>(STORAGE_KEYS.invoices, [])
}

export function saveInvoices(invoices: Invoice[]): void {
  storageSet(STORAGE_KEYS.invoices, invoices)
}

/** Net line-item total before WHT. */
export function calcSubtotal(inv: Invoice): number {
  return inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
}

/**
 * The gross amount the client pays (subtotal + WHT if applicable).
 * Use this everywhere a "total" or "earned" figure is needed so that
 * WHT invoices are counted consistently across clients, reports, and projects.
 */
export function calcInvoiceTotal(inv: Invoice): number {
  const sub = calcSubtotal(inv)
  return inv.wht ? sub * (1 + WHT_RATE) : sub
}
