import { getDoc, setDoc, doc } from 'firebase/firestore'
import { db } from '@/app/_lib/firebase'
import type { CompanyProfile, PaymentInfo } from '@/app/dashboard/AppStore'

const EMPTY_PROFILE: CompanyProfile = {
  name: '', logo: '', address: '', phone: '', website: '',
  signatoryName: '', signatorySignature: '',
}
const EMPTY_PAYMENT: PaymentInfo = {
  bankName: '', accountName: '', accountNumber: '',
  swiftCode: '', currency: '', qrImage: '',
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'company'))
    return snap.exists() ? (snap.data() as CompanyProfile) : EMPTY_PROFILE
  } catch {
    return EMPTY_PROFILE
  }
}

export async function saveCompanyProfile(p: CompanyProfile): Promise<void> {
  await setDoc(doc(db, 'settings', 'company'), p)
}

export async function getPaymentInfo(): Promise<PaymentInfo> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'payment'))
    return snap.exists() ? (snap.data() as PaymentInfo) : EMPTY_PAYMENT
  } catch {
    return EMPTY_PAYMENT
  }
}

export async function savePaymentInfo(p: PaymentInfo): Promise<void> {
  await setDoc(doc(db, 'settings', 'payment'), p)
}
