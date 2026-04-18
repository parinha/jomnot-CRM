'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import SidebarHeader from './SidebarHeader';
import TelegramProjectsButton from './TelegramProjectsButton';
import QuickPayModal from '@/src/features/payments/components/QuickPayModal';
import type { CompanyProfile, InvoiceStatus } from '@/src/types';
import { useAuth } from '@/src/features/auth/components/AuthProvider';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import { fmtUSD } from '@/src/lib/formatters';
import { calcSubtotal } from '@/src/features/invoices/lib/calculations';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useCompanyProfile } from '@/src/hooks/useSettings';

type SidebarSize = 'full' | 'compact' | 'hidden';
const SIDEBAR_SIZES: SidebarSize[] = ['full', 'compact', 'hidden'];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: clients } = useClients();
  const { data: invoices } = useInvoices();
  const { data: companyProfile } = useCompanyProfile();
  const { signOut } = useAuth();
  const [quickPay, setQuickPay] = useState(false);
  const [sidebarSize, setSidebarSize] = useState<SidebarSize>(() => {
    if (typeof window === 'undefined') return 'hidden';
    const saved = localStorage.getItem('sidebarSize') as SidebarSize | null;
    if (saved && SIDEBAR_SIZES.includes(saved)) return saved;
    return window.innerWidth >= 768 ? 'compact' : 'hidden';
  });

  const sidebarOpen = sidebarSize !== 'hidden';
  function closeSidebar() {
    setSidebarSize('hidden');
    localStorage.setItem('sidebarSize', 'hidden');
  }

  function handleNavClick() {
    if (window.innerWidth < 768) closeSidebar();
  }

  function cycleSidebar() {
    const next = SIDEBAR_SIZES[(SIDEBAR_SIZES.indexOf(sidebarSize) + 1) % SIDEBAR_SIZES.length];
    setSidebarSize(next);
    localStorage.setItem('sidebarSize', next);
  }

  const compact = sidebarSize === 'compact';

  const [amountsVisible, setAmountsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('amountsVisible') === 'true';
  });

  function toggleAmountsVisible() {
    setAmountsVisible((prev) => {
      const next = !prev;
      sessionStorage.setItem('amountsVisible', String(next));
      return next;
    });
  }

  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handlePopState() {
      if (!window.location.pathname.startsWith('/dashboard')) {
        router.replace('/dashboard/timeline');
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
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
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
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
          const total = calcSubtotal(inv);
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

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setShowResults(false);
      setQuery('');
    }
  }

  return (
    <div
      className="h-dvh flex bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900"
      data-amounts-hidden={!amountsVisible}
    >
      {/* Sidebar backdrop — mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-600/10 rounded-full blur-3xl" />
      </div>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col',
          'bg-black/65 backdrop-blur-2xl border-r border-white/[0.08]',
          'transition-all duration-300 ease-out will-change-transform',
          sidebarSize === 'compact' ? 'w-14' : 'w-72',
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          'md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 md:shadow-none',
          sidebarSize === 'full'
            ? 'md:w-56'
            : sidebarSize === 'compact'
              ? 'md:w-14'
              : 'md:w-0 md:min-w-0 md:overflow-hidden md:border-r-0',
        ].join(' ')}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      >
        {/* Sidebar header */}
        {compact ? (
          <CompactSidebarHeader
            profile={companyProfile ?? { name: '', logo: '', address: '', phone: '', website: '' }}
          />
        ) : (
          <SidebarHeader
            profile={companyProfile ?? { name: '', logo: '', address: '', phone: '', website: '' }}
          />
        )}

        <nav
          className={`flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto ${compact ? 'px-1.5' : 'px-3'}`}
        >
          <NavItem
            href="/dashboard/timeline"
            label="Timeline"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />
          <NavItem
            href="/dashboard/kanban"
            label="Kanban"
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />
          <div className="my-2 border-t border-white/[0.06]" />
          <NavItem
            href="/dashboard/projects"
            label="Projects"
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />
          <NavItem
            href="/dashboard/clients"
            label="Clients"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />
          <div className="my-2 border-t border-white/[0.06]" />
          <NavItem
            href="/dashboard/invoices"
            label="Invoices"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />
          <NavItem
            href="/dashboard/payments"
            label="Payments"
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />
        </nav>

        <div
          className={`py-3 border-t border-white/[0.06] shrink-0 flex flex-col gap-0.5 ${compact ? 'px-1.5' : 'px-3'}`}
        >
          <NavItem
            href="/dashboard/settings"
            label="Settings"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            pathname={pathname}
            onClick={handleNavClick}
            compact={compact}
          />

          <button
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
            title="Sign out"
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/50 hover:bg-white/[0.06] hover:text-white/80 active:bg-white/10 transition w-full ${compact ? 'justify-center' : 'text-left'}`}
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
            {!compact && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top header */}
        <header
          className="sticky top-0 z-30 bg-black/30 backdrop-blur-xl border-b border-white/[0.08] shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className="h-14 md:h-16 flex items-center gap-3"
            style={{
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
            }}
          >
            {/* Sidebar size toggle */}
            <button
              onClick={cycleSidebar}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.08] active:bg-white/[0.12] transition shrink-0"
            >
              {sidebarOpen ? (
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
                    d="M11 19l-7-7 7-7M21 19l-7-7 7-7"
                  />
                </svg>
              ) : (
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
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              )}
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
                onKeyDown={onSearchKeyDown}
                placeholder="Search…"
                className="w-full h-10 pl-10 pr-10 rounded-xl border border-white/15 bg-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent backdrop-blur-sm transition"
                style={{ fontSize: '16px' }}
              />
              {!query && (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-white/30 bg-white/10 border border-white/15 pointer-events-none hidden sm:block">
                  Space
                </kbd>
              )}
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setShowResults(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/70 transition"
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
                              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.06] active:bg-white/[0.1] transition text-left"
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
                          className={
                            matchedClients.length > 0 ? 'border-t border-white/[0.06]' : ''
                          }
                        >
                          <p className="px-4 py-2.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
                            Invoices
                          </p>
                          {matchedInvoices.map((inv) => {
                            const client = clients.find((c) => c.id === inv.clientId);
                            const total = calcSubtotal(inv);
                            const status = (inv.status ?? 'draft') as InvoiceStatus;
                            const sc = STATUS_CONFIG[status];
                            return (
                              <button
                                key={inv.id}
                                onClick={() => go('/dashboard/invoices')}
                                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.06] active:bg-white/[0.1] transition text-left"
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
              <TelegramProjectsButton />
              <button
                onClick={toggleAmountsVisible}
                title={amountsVisible ? 'Hide amounts' : 'Show amounts'}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-white/50 hover:text-white hover:bg-white/10 active:bg-white/15 transition"
              >
                {amountsVisible ? (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                ) : (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setQuickPay(true)}
                className="flex items-center gap-2 h-10 px-3 md:px-4 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 text-sm font-medium hover:bg-green-500/30 active:bg-green-500/40 transition"
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Clear Payment</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overscroll-y-contain main-content-pad">
          {children}
        </main>
      </div>

      {quickPay && (
        <QuickPayModal invoices={invoices} clients={clients} onClose={() => setQuickPay(false)} />
      )}

      {/* Mobile bottom navigation bar */}
      <MobileBottomNav pathname={pathname} onClick={handleNavClick} />

      {/* Mobile FAB */}
      <MobileFAB onQuickPay={() => setQuickPay(true)} />
    </div>
  );
}

// ── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  d,
  pathname,
  onClick,
  compact,
}: {
  href: string;
  label: string;
  d: string;
  pathname: string | null;
  onClick?: () => void;
  compact?: boolean;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      title={compact ? label : undefined}
      className={[
        'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
        compact ? 'justify-center w-full h-10' : 'gap-3 px-3 py-3',
        active
          ? 'bg-[#FFC206]/15 text-[#FFC206] border border-[#FFC206]/20'
          : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90 active:bg-white/10',
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
      {!compact && label}
    </Link>
  );
}

// ── Mobile floating action button ───────────────────────────────────────────

const FAB_ACTIONS = [
  {
    key: 'invoice',
    label: 'Create Invoice',
    href: '/dashboard/invoices?new=1',
    iconD:
      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'bg-blue-500/20 border-blue-400/40 text-blue-300',
  },
  {
    key: 'client',
    label: 'Create Client',
    href: '/dashboard/clients?new=1',
    iconD: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
    color: 'bg-purple-500/20 border-purple-400/40 text-purple-300',
  },
  {
    key: 'project',
    label: 'Create Project',
    href: '/dashboard/projects?new=1',
    iconD: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
    color: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
  },
  {
    key: 'payment',
    label: 'Accept Payment',
    href: null,
    iconD: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'bg-green-500/20 border-green-400/40 text-green-300',
  },
] as const;

function MobileFAB({ onQuickPay }: { onQuickPay: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleAction(href: string | null) {
    setOpen(false);
    if (href) {
      router.push(href);
    } else {
      onQuickPay();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)} />}

      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-3 md:hidden"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {/* Action items — visible when open */}
        {open && (
          <div className="flex flex-col items-end gap-2">
            {FAB_ACTIONS.map(({ key, label, href, iconD, color }) => (
              <button
                key={key}
                onClick={() => handleAction(href)}
                className={`flex items-center gap-2.5 h-11 pl-3.5 pr-4 rounded-2xl border backdrop-blur-xl shadow-lg text-sm font-semibold transition-all active:scale-95 ${color}`}
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={iconD} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-[#FFC206] text-zinc-900 shadow-lg shadow-amber-500/30 flex items-center justify-center transition-transform active:scale-95"
          style={{ boxShadow: '0 4px 20px rgba(255,194,6,0.4)' }}
        >
          <svg
            className={`w-6 h-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </>
  );
}

// ── Mobile bottom navigation bar ────────────────────────────────────────────

const BOTTOM_NAV_ITEMS = [
  {
    href: '/dashboard/timeline',
    label: 'Timeline',
    d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/dashboard/kanban',
    label: 'Kanban',
    d: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  },
  {
    href: '/dashboard/projects',
    label: 'Projects',
    d: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  },
  {
    href: '/dashboard/clients',
    label: 'Clients',
    d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    href: '/dashboard/invoices',
    label: 'Invoices',
    d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
];

function MobileBottomNav({ pathname, onClick }: { pathname: string | null; onClick: () => void }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-black/80 backdrop-blur-2xl border-t border-white/[0.08] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-14">
        {BOTTOM_NAV_ITEMS.map(({ href, label, d }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClick}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                active ? 'text-[#FFC206]' : 'text-white/40 active:text-white/70',
              ].join(' ')}
            >
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={active ? 2.5 : 1.75}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={d} />
              </svg>
              <span className="text-[9px] font-semibold leading-none tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Compact sidebar header ────────────────────────────────────────────────────

function CompactSidebarHeader({ profile }: { profile: CompanyProfile }) {
  const initial = (profile.name || 'S').charAt(0).toUpperCase();
  return (
    <div className="h-16 flex items-center justify-center border-b border-white/[0.08] shrink-0">
      {profile.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg" />
      ) : (
        <div className="h-8 w-8 rounded-lg bg-[#FFC206] flex items-center justify-center text-zinc-900 text-xs font-bold shrink-0 shadow-amber-500/30">
          {initial}
        </div>
      )}
    </div>
  );
}
