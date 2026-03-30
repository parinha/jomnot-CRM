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
 * Total the client pays: subtotal + WHT (if applicable).
 * WHT is an additional tax the CLIENT pays on top and remits to the Revenue Dept.
 * The freelancer receives the subtotal in full — they are not affected by WHT.
 */
export function calcInvoiceTotal(inv: Invoice): number {
  const sub = calcSubtotal(inv)
  return inv.wht ? sub * (1 + WHT_RATE) : sub
}

/**
 * Cash actually received by the freelancer for this invoice.
 * Always based on subtotal — WHT is the client's obligation and does not
 * reduce the freelancer's payment.
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
 * - paid    → 0
 * - partial → subtotal minus deposit already received
 * - others  → full subtotal (nothing received yet)
 */
export function calcBalance(inv: Invoice): number {
  return calcSubtotal(inv) - calcEarned(inv)
}
