import Link from 'next/link'
import { AppStoreProvider } from './AppStore'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStoreProvider>
      <div className="min-h-screen flex bg-zinc-100">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-white border-r border-zinc-200 flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-zinc-200">
            <span className="text-base font-semibold text-zinc-900">Studio</span>
          </div>
          <nav className="flex-1 p-3 flex flex-col gap-0.5">
            <NavItem href="/dashboard/clients" label="Clients">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </NavItem>
            <NavItem href="/dashboard/invoices" label="Invoices">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </NavItem>
          </nav>
          <div className="p-3 border-t border-zinc-100">
            <NavItem href="/dashboard/settings" label="Settings">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </NavItem>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-zinc-200 flex items-center px-6 justify-between shrink-0">
            <span className="text-sm text-zinc-500">Dashboard</span>
            <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition">
              Sign out
            </Link>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </AppStoreProvider>
  )
}

function NavItem({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition"
    >
      <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {children}
      </svg>
      {label}
    </Link>
  )
}
