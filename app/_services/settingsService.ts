import { storageGet, storageSet } from '@/app/_lib/storage'
import { STORAGE_KEYS } from '@/app/_config/constants'
import type { CompanyProfile, PaymentInfo } from '@/app/dashboard/AppStore'

const EMPTY_PROFILE: CompanyProfile = { name: '', logo: '', address: '', phone: '', website: '' }
const EMPTY_PAYMENT: PaymentInfo    = { abaSwift: '', accountNumber: '', accountName: '', qrImage: '' }

export function getCompanyProfile(): CompanyProfile {
  return storageGet<CompanyProfile>(STORAGE_KEYS.companyProfile, EMPTY_PROFILE)
}

export function saveCompanyProfile(p: CompanyProfile): void {
  storageSet(STORAGE_KEYS.companyProfile, p)
}

export function getPaymentInfo(): PaymentInfo {
  return storageGet<PaymentInfo>(STORAGE_KEYS.paymentInfo, EMPTY_PAYMENT)
}

export function savePaymentInfo(p: PaymentInfo): void {
  storageSet(STORAGE_KEYS.paymentInfo, p)
}
