'use client'

import { useState } from 'react'
import Link from 'next/link'
import SidebarHeader from './SidebarHeader'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="min-h-screen flex bg-zinc-100">
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={close} />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col',
          'transition-transform duration-200 ease-in-out',
          'md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Mobile close button */}
        <button
          onClick={close}
          className="md:hidden absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <SidebarHeader />

        <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
          <NavItem href="/dashboard/clients"  label="Clients"  onClick={close} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          <NavItem href="/dashboard/invoices" label="Invoices" onClick={close} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <NavItem href="/dashboard/reports"  label="Reports"  onClick={close} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </nav>

        {/* Settings — pinned to bottom */}
        <div className="p-3 border-t border-zinc-100 shrink-0">
          <NavItem href="/dashboard/settings" label="Settings" onClick={close} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 bg-white border-b border-zinc-200 flex items-center px-4 md:px-6 justify-between shrink-0 sticky top-0 z-30">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <span className="text-sm text-zinc-500 hidden md:block">Dashboard</span>

          <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition">
            Sign out
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

function NavItem({ href, label, d, onClick }: { href: string; label: string; d: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-amber-50 hover:text-zinc-900 active:bg-amber-100 transition"
    >
      <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
      {label}
    </Link>
  )
}
