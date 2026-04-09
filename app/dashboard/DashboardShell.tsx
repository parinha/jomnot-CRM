'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import SidebarHeader from './SidebarHeader';
import { useStore, type InvoiceStatus } from './AppStore';
import { useAuth } from '@/app/_context/AuthContext';
import { STATUS_CONFIG } from '@/app/_config/statusConfig';
import { fmtUSD } from '@/app/_lib/formatters';
import { calcInvoiceTotal } from '@/app/_services/invoiceService';
import QuickPayModal from '@/app/_components/QuickPayModal';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { signOut } = useAuth();
  const [quickPay, setQuickPay] = useState(false);

  const { clients, invoices } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== ' ') return;
      const tag = (e.target as HTMLElement).tagName;
      const editable = (e.target as HTMLElement).isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
      e.preventDefault();
      inputRef.current?.focus();
      setShowResults(true);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const q = query.trim().toLowerCase();

  const matchedClients = q
    ? clients
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            (c.note ?? '').toLowerCase().includes(q)
        )
        .slice(0, 5)
    : [];

  const matchedInvoices = q
    ? invoices
        .filter((inv) => {
          const client = clients.find((c) => c.id === inv.clientId);
          const total = calcInvoiceTotal(inv);
          return [inv.number, client?.name ?? '', fmtUSD(total), inv.status]
            .join(' ')
            .toLowerCase()
            .includes(q);
        })
        .slice(0, 5)
    : [];

  function go(href: string) {
    router.push(href);
    setShowResults(false);
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setShowResults(false);
      setQuery('');
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-600/10 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col',
          'bg-black/50 backdrop-blur-2xl border-r border-white/[0.08]',
          'transition-transform duration-200 ease-in-out',
          'md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        ].join(' ')}
      >
        <button
          onClick={close}
          className="md:hidden absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
          aria-label="Close menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <SidebarHeader />

        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          <NavItem
            href="/dashboard"
            label="Dashboard"
            onClick={close}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            pathname={pathname}
          />
          <div className="my-2 border-t border-white/[0.06]" />
          <NavItem
            href="/dashboard/clients"
            label="Clients"
            onClick={close}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            pathname={pathname}
          />
          <NavItem
            href="/dashboard/projects"
            label="Projects"
            onClick={close}
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            pathname={pathname}
          />
          <div className="my-2 border-t border-white/[0.06]" />
          <NavItem
            href="/dashboard/invoices"
            label="Invoices"
            onClick={close}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            pathname={pathname}
          />
          <NavItem
            href="/dashboard/payments"
            label="Payments"
            onClick={close}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            pathname={pathname}
          />
          <div className="my-2 border-t border-white/[0.06]" />
          <NavItem
            href="/dashboard/reports"
            label="Reports"
            onClick={close}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            pathname={pathname}
          />
        </nav>

        <div className="px-3 py-3 border-t border-white/[0.06] shrink-0 flex flex-col gap-0.5">
          <NavItem
            href="/dashboard/settings"
            label="Settings"
            onClick={close}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            pathname={pathname}
          />
          <button
            onClick={async () => {
              close();
              await signOut();
              router.replace('/login');
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/50 hover:bg-white/[0.06] hover:text-white/80 transition w-full text-left"
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top header */}
        <header className="h-16 bg-black/30 backdrop-blur-xl border-b border-white/[0.08] flex items-center px-4 md:px-6 gap-3 shrink-0 sticky top-0 z-30">
          {/* Mobile menu toggle - hidden since bottom nav handles navigation */}
          <button
            onClick={() => setOpen(true)}
            className="hidden p-2.5 -ml-1 rounded-xl text-white/60 hover:bg-white/10 hover:text-white shrink-0 transition"
            aria-label="Open menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div ref={searchRef} className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => {
                if (query) setShowResults(true);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search clients, invoices…"
              className="w-full h-10 pl-10 pr-16 rounded-xl border border-white/15 bg-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent backdrop-blur-sm transition"
            />
            {!query && (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-white/30 bg-white/10 border border-white/15 pointer-events-none">
                Space
              </kbd>
            )}
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {showResults && query && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
                {matchedClients.length === 0 && matchedInvoices.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-white/40 text-center">
                    No results for &quot;{query}&quot;
                  </p>
                ) : (
                  <>
                    {matchedClients.length > 0 && (
                      <div>
                        <p className="px-4 py-2.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
                          Clients
                        </p>
                        {matchedClients.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => go('/dashboard/clients')}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.06] transition text-left"
                          >
                            <div className="w-9 h-9 rounded-xl bg-[#FFC206]/20 text-[#FFC206] flex items-center justify-center text-xs font-bold shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{c.name}</p>
                              <p className="text-xs text-white/40 truncate">
                                {c.email || c.phone || '—'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {matchedInvoices.length > 0 && (
                      <div
                        className={matchedClients.length > 0 ? 'border-t border-white/[0.06]' : ''}
                      >
                        <p className="px-4 py-2.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
                          Invoices
                        </p>
                        {matchedInvoices.map((inv) => {
                          const client = clients.find((c) => c.id === inv.clientId);
                          const total = calcInvoiceTotal(inv);
                          const status = (inv.status ?? 'draft') as InvoiceStatus;
                          const sc = STATUS_CONFIG[status];
                          return (
                            <button
                              key={inv.id}
                              onClick={() => go('/dashboard/invoices')}
                              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.06] transition text-left"
                            >
                              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <svg
                                  className="w-4 h-4 text-white/60"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-white">{inv.number}</p>
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sc.cls}`}
                                  >
                                    {sc.label}
                                  </span>
                                </div>
                                <p className="text-xs text-white/40 truncate">
                                  {client?.name ?? '—'} · {fmtUSD(total)}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Header actions */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={() => setQuickPay(true)}
              className="flex items-center gap-2 h-11 px-4 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 text-sm font-medium hover:bg-green-500/30 transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden sm:inline">Clear Payment</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">{children}</main>
      </div>

      {/* Bottom Navigation - Mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-black/70 backdrop-blur-2xl border-t border-white/[0.08]">
        <div className="flex items-center h-16 px-1">
          <BottomNavItem
            href="/dashboard"
            label="Home"
            onClick={close}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            pathname={pathname}
          />
          <BottomNavItem
            href="/dashboard/clients"
            label="Clients"
            onClick={close}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            pathname={pathname}
          />
          <BottomNavItem
            href="/dashboard/invoices"
            label="Invoices"
            onClick={close}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            pathname={pathname}
          />
          <BottomNavItem
            href="/dashboard/projects"
            label="Projects"
            onClick={close}
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            pathname={pathname}
          />
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 h-full text-white/45 hover:text-white/70 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {quickPay && <QuickPayModal onClose={() => setQuickPay(false)} />}
    </div>
  );
}

function NavItem({
  href,
  label,
  d,
  onClick,
  pathname,
}: {
  href: string;
  label: string;
  d: string;
  onClick: () => void;
  pathname: string | null;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition',
        active
          ? 'bg-[#FFC206]/15 text-[#FFC206] border border-[#FFC206]/20'
          : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90',
      ].join(' ')}
    >
      <svg
        className={['w-4 h-4 shrink-0', active ? 'text-[#FFC206]' : 'text-white/40'].join(' ')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
      {label}
    </Link>
  );
}

function BottomNavItem({
  href,
  label,
  d,
  onClick,
  pathname,
}: {
  href: string;
  label: string;
  d: string;
  onClick: () => void;
  pathname: string | null;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-1 h-full transition"
    >
      <svg
        className={['w-5 h-5', active ? 'text-[#FFC206]' : 'text-white/45'].join(' ')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
      <span
        className={['text-[10px] font-semibold', active ? 'text-[#FFC206]' : 'text-white/45'].join(
          ' '
        )}
      >
        {label}
      </span>
    </Link>
  );
}
