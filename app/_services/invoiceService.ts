import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/_lib/firebase';
import type { Invoice } from '@/app/dashboard/AppStore';

export const WHT_RATE = 0.15;

export async function getInvoices(): Promise<Invoice[]> {
  const snap = await getDocs(collection(db, 'invoices'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice);
}

/**
 * Gross invoice total (what appears on the invoice face).
 * When WHT is on, unit prices are already stored as gross, so this is the
 * gross total. When WHT is off, this equals the deal total.
 */
export function calcSubtotal(inv: Invoice): number {
  return inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
}

/**
 * Net amount the freelancer actually receives.
 * With WHT: gross × (1 − WHT_RATE). Without WHT: same as subtotal.
 */
export function calcNet(inv: Invoice): number {
  const gross = calcSubtotal(inv);
  return inv.withWHT ? gross * (1 - WHT_RATE) : gross;
}

/** @deprecated use calcSubtotal */
export function calcInvoiceTotal(inv: Invoice): number {
  return calcSubtotal(inv);
}

/**
 * Cash actually received by the freelancer for this invoice.
 * - paid    → full net amount
 * - partial → deposit portion of net
 * - all others → 0
 */
export function calcEarned(inv: Invoice): number {
  const net = calcNet(inv);
  if (inv.status === 'paid') return net;
  if (inv.status === 'partial') return net * ((inv.depositPercent ?? 0) / 100);
  return 0;
}

/**
 * Amount the freelancer still expects to receive.
 */
export function calcBalance(inv: Invoice): number {
  return calcNet(inv) - calcEarned(inv);
}
