'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface Client {
  id: string
  name: string
  phone: string
  address: string
  email: string
}

export interface LineItem {
  id: string
  description: string
  qty: number
  unitPrice: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface Invoice {
  id: string
  number: string
  date: string
  paymentTerms: string
  status: InvoiceStatus
  clientId: string
  items: LineItem[]
  wht: boolean
  notes: string
}

export interface CompanyProfile {
  name: string
  logo: string        // base64 data URL or ''
  address: string
  phone: string
  website: string
}

export interface PaymentInfo {
  abaSwift: string
  accountNumber: string
  accountName: string
  qrImage: string     // base64 data URL or ''
}

const DEFAULT_SCOPES = [
  'Video content',
  'Photo album (5–10 photos)',
  'Joining event — shoutout photo/video',
  'Short reel with music',
  'Story',
]

interface AppStore {
  clients: Client[]
  setClients: (c: Client[]) => void
  invoices: Invoice[]
  setInvoices: (inv: Invoice[]) => void
  scopeOfWork: string[]
  setScopeOfWork: (s: string[]) => void
}

const StoreCtx = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [clients, setClientsState] = useState<Client[]>([])
  const [invoices, setInvoicesState] = useState<Invoice[]>([])
  const [scopeOfWork, setScopeOfWorkState] = useState<string[]>(DEFAULT_SCOPES)

  useEffect(() => {
    try {
      const c = localStorage.getItem('app_clients')
      const i = localStorage.getItem('app_invoices')
      const s = localStorage.getItem('app_scopes')
      if (c) setClientsState(JSON.parse(c))
      if (i) setInvoicesState(JSON.parse(i))
      if (s) setScopeOfWorkState(JSON.parse(s))
    } catch {}
  }, [])

  function setClients(c: Client[]) {
    setClientsState(c)
    localStorage.setItem('app_clients', JSON.stringify(c))
  }

  function setInvoices(inv: Invoice[]) {
    setInvoicesState(inv)
    localStorage.setItem('app_invoices', JSON.stringify(inv))
  }

  function setScopeOfWork(s: string[]) {
    setScopeOfWorkState(s)
    localStorage.setItem('app_scopes', JSON.stringify(s))
  }

  return (
    <StoreCtx.Provider value={{ clients, setClients, invoices, setInvoices, scopeOfWork, setScopeOfWork }}>
      {children}
    </StoreCtx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider')
  return ctx
}

// Helpers for settings stored outside the React tree (used by print page too)
function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(key) } catch { return null }
}

export function loadCompanyProfile(): CompanyProfile {
  try {
    const raw = safeGet('company_profile')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: '', logo: '', address: '', phone: '', website: '' }
}

export function saveCompanyProfile(p: CompanyProfile) {
  try { localStorage.setItem('company_profile', JSON.stringify(p)) } catch {}
}

export function loadPaymentInfo(): PaymentInfo {
  try {
    const raw = safeGet('payment_info')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { abaSwift: '', accountNumber: '', accountName: '', qrImage: '' }
}

export function savePaymentInfo(p: PaymentInfo) {
  localStorage.setItem('payment_info', JSON.stringify(p))
}
