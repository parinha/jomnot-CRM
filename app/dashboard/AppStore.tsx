'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { DEFAULT_SCOPES } from '@/app/_config/constants'
import { getClients,  saveClients  } from '@/app/_services/clientService'
import { getInvoices, saveInvoices } from '@/app/_services/invoiceService'
import { getProjects, saveProjects } from '@/app/_services/projectService'
import { getScopes,   saveScopes   } from '@/app/_services/scopeService'

// ── Domain types ──────────────────────────────────────────────────────────────

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

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'

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
  depositPercent?: number
}

export interface CompanyProfile {
  name: string
  logo: string
  address: string
  phone: string
  website: string
}

export interface PaymentInfo {
  abaSwift: string
  accountNumber: string
  accountName: string
  qrImage: string
}

export type ProjectItemStatus = 'todo' | 'in-progress' | 'done'

export interface ProjectItem {
  id: string
  description: string
  status: ProjectItemStatus
}

export type ProjectStatus = 'active' | 'completed' | 'on-hold'

export interface Project {
  id: string
  name: string
  clientId: string
  invoiceIds: string[]
  items: ProjectItem[]
  status: ProjectStatus
  createdAt: string
}

// ── Store interface ───────────────────────────────────────────────────────────

interface AppStore {
  clients: Client[]
  setClients: (c: Client[]) => void
  invoices: Invoice[]
  setInvoices: (inv: Invoice[]) => void
  projects: Project[]
  setProjects: (p: Project[]) => void
  scopeOfWork: string[]
  setScopeOfWork: (s: string[]) => void
}

const StoreCtx = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [clients,     setClientsState]     = useState<Client[]>([])
  const [invoices,    setInvoicesState]    = useState<Invoice[]>([])
  const [projects,    setProjectsState]    = useState<Project[]>([])
  const [scopeOfWork, setScopeOfWorkState] = useState<string[]>(DEFAULT_SCOPES)

  // Initial hydration from storage (swap getClients() for Firestore queries when migrating)
  useEffect(() => {
    setClientsState(getClients())
    setInvoicesState(getInvoices())
    setProjectsState(getProjects())
    setScopeOfWorkState(getScopes())
  }, [])

  function setClients(c: Client[]) {
    setClientsState(c)
    saveClients(c)
  }

  function setInvoices(inv: Invoice[]) {
    setInvoicesState(inv)
    saveInvoices(inv)
  }

  function setProjects(p: Project[]) {
    setProjectsState(p)
    saveProjects(p)
  }

  function setScopeOfWork(s: string[]) {
    setScopeOfWorkState(s)
    saveScopes(s)
  }

  return (
    <StoreCtx.Provider value={{ clients, setClients, invoices, setInvoices, projects, setProjects, scopeOfWork, setScopeOfWork }}>
      {children}
    </StoreCtx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider')
  return ctx
}

// ── Settings helpers (re-exported from settingsService for backward compat) ───
export { getCompanyProfile  as loadCompanyProfile  } from '@/app/_services/settingsService'
export { saveCompanyProfile                        } from '@/app/_services/settingsService'
export { getPaymentInfo     as loadPaymentInfo     } from '@/app/_services/settingsService'
export { savePaymentInfo                           } from '@/app/_services/settingsService'
