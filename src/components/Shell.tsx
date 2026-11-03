'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowClockwise,
  ClipboardText,
  Eye,
  EyeSlash,
  FilePlus,
  FileText,
  GearSix,
  House,
  MagnifyingGlass,
  Plus,
  Receipt,
  UserPlus,
  UsersThree,
  X,
  type Icon,
} from '@phosphor-icons/react';
import type { CompanyProfile, InvoiceStatus } from '@/src/types';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import { fmtCurrency } from '@/src/lib/formatters';
import { calcSubtotal } from '@/src/lib/calculations';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useCompanyProfile, useAppPreferences } from '@/src/hooks/useSettings';

// ── Navigation config ────────────────────────────────────────────────────────

const BOTTOM_TABS: { href: string; label: string; icon: Icon }[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/clients', label: 'Clients', icon: UsersThree },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/quotations', label: 'Quotes', icon: ClipboardText },
  { href: '/settings', label: 'Settings', icon: GearSix },
];

const FAB_ACTIONS: { key: string; label: string; href: string; icon: Icon }[] = [
  { key: 'invoice', label: 'Create Invoice', href: '/invoices?new=1', icon: FilePlus },
  { key: 'quote', label: 'Create Quotation', href: '/quotations?new=1', icon: FileText },
  { key: 'client', label: 'Create Client', href: '/clients?new=1', icon: UserPlus },
];

// ── Shell ────────────────────────────────────────────────────────────────────

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: clients } = useClients();
  const { data: invoices } = useInvoices();
  const { data: companyProfile } = useCompanyProfile();
  const { data: prefs } = useAppPreferences();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    }
    window.location.reload();
  }, [refreshing]);

  const [amountsVisible, setAmountsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = sessionStorage.getItem('amountsVisible');
    return saved === null ? true : saved === 'true';
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
  const isHome = pathname === '/dashboard';
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handlePopState() {
      if (!window.location.pathname.startsWith('/')) {
        router.replace('/invoices');
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
          return [
            inv.number,
            client?.name ?? '',
            fmtCurrency(total, prefs.currencyCode),
            inv.status,
          ]
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

  const profile: CompanyProfile = companyProfile ?? {
    name: '',
    logo: '',
    address: '',
    phone: '',
    website: '',
  };
  const initial = (profile.name || 'S').charAt(0).toUpperCase();

  // Header switches between the green Home hero and a clean white app bar
  // (iPad and up always uses the white app bar; the green hero lives in the Home content)
  const iconBtn = isHome
    ? 'text-on-brand/90 hover:bg-on-brand/10 active:bg-on-brand/15 md:text-ink-2 md:hover:bg-black/[0.04] md:active:bg-black/[0.07]'
    : 'text-ink-2 hover:bg-black/[0.04] active:bg-black/[0.07]';

  return (
    <div className="h-dvh flex bg-canvas" data-amounts-hidden={!amountsVisible}>
      {/* ── Sidebar (iPad and up) ────────────────────────────────────────── */}
      <Sidebar pathname={pathname} profile={profile} initial={initial} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Topbar ───────────────────────────────────────────────────────── */}
        <header
          className={`sticky top-0 z-30 shrink-0 transition-colors ${
            isHome
              ? 'bg-brand md:bg-surface md:border-b md:border-line'
              : 'bg-surface border-b border-line'
          }`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className="h-16 flex items-center gap-2.5"
            style={{
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
            }}
          >
            {/* Company identity (phones; the sidebar shows it on iPad+) */}
            <div className="flex items-center gap-2 shrink-0 md:hidden">
              {profile.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logo}
                  alt="Logo"
                  className="h-9 w-9 object-contain rounded-full bg-white p-0.5 shadow-card"
                />
              ) : (
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isHome ? 'bg-white text-brand-ink shadow-card' : 'bg-brand text-on-brand'
                  }`}
                >
                  {initial}
                </div>
              )}
              <span
                className={`hidden sm:block text-base font-semibold truncate max-w-[140px] ${
                  isHome ? 'text-on-brand' : 'text-ink'
                }`}
              >
                {profile.name || 'Studio'}
              </span>
            </div>

            {/* Search */}
            <div ref={searchRef} className="relative flex-1 min-w-0 md:max-w-xl">
              <MagnifyingGlass
                weight="duotone"
                aria-hidden
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${
                  isHome ? 'text-brand-ink md:text-muted' : 'text-muted'
                }`}
              />
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
                placeholder="Search invoices, clients…"
                className={`w-full h-11 pl-11 pr-10 rounded-full text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 transition ${
                  isHome
                    ? 'bg-white shadow-card focus:ring-white/60 md:bg-subtle md:shadow-none md:focus:ring-brand/40 md:focus:bg-surface'
                    : 'bg-subtle focus:ring-brand/40 focus:bg-surface'
                }`}
                style={{ fontSize: '16px' }}
              />

              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setShowResults(false);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:bg-black/[0.05] transition"
                >
                  <X weight="bold" className="w-4 h-4" aria-hidden />
                </button>
              )}

              {/* Search results dropdown */}
              {showResults && query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-2xl border border-line shadow-float z-50 overflow-hidden max-h-[420px] overflow-y-auto">
                  {matchedClients.length === 0 && matchedInvoices.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted text-center">
                      No results for &quot;{query}&quot;
                    </p>
                  ) : (
                    <>
                      {matchedClients.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-muted">
                            Clients
                          </p>
                          {matchedClients.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => go('/clients')}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-subtle active:bg-black/[0.06] transition text-left"
                            >
                              <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center text-sm font-bold shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                                <p className="text-xs text-muted truncate">
                                  {c.email || c.phone || '—'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {matchedInvoices.length > 0 && (
                        <div className={matchedClients.length > 0 ? 'border-t border-line' : ''}>
                          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-muted">
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
                                onClick={() => go('/invoices')}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-subtle active:bg-black/[0.06] transition text-left"
                              >
                                <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                                  <Receipt
                                    weight="duotone"
                                    className="w-5 h-5 text-brand-ink"
                                    aria-hidden
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-ink">{inv.number}</p>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                                    >
                                      {sc.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted truncate">
                                    {client?.name ?? '—'} · {fmtCurrency(total, prefs.currencyCode)}
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

            {/* Topbar actions */}
            <div className="flex items-center gap-0.5 shrink-0 md:ml-auto">
              <button
                onClick={toggleAmountsVisible}
                title={amountsVisible ? 'Hide amounts' : 'Show amounts'}
                aria-label={amountsVisible ? 'Hide amounts' : 'Show amounts'}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition ${iconBtn}`}
              >
                {amountsVisible ? (
                  <Eye weight="duotone" className="w-5 h-5" aria-hidden />
                ) : (
                  <EyeSlash weight="duotone" className="w-5 h-5" aria-hidden />
                )}
              </button>
              <button
                onClick={handleRefresh}
                title="Refresh"
                aria-label="Refresh"
                className={`flex items-center justify-center w-10 h-10 rounded-full transition ${iconBtn}`}
              >
                <ArrowClockwise
                  weight="bold"
                  className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overscroll-y-contain main-content-pad relative">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Phone-only: floating create button + bottom tab bar */}
      <MobileFAB />
      <BottomTabBar pathname={pathname} />
    </div>
  );
}

// ── Sidebar (iPad and up) ────────────────────────────────────────────────────
// iPad portrait (md): slim icon rail. iPad landscape / desktop (lg): full sidebar with labels.

function Sidebar({
  pathname,
  profile,
  initial,
}: {
  pathname: string | null;
  profile: CompanyProfile;
  initial: string;
}) {
  return (
    <aside
      className="hidden md:flex shrink-0 flex-col w-[88px] lg:w-64 bg-surface border-r border-line"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
      }}
    >
      {/* Identity */}
      <div className="h-16 flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-5 shrink-0">
        {profile.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.logo}
            alt="Logo"
            className="h-10 w-10 object-contain rounded-full bg-white p-0.5 shadow-card shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-brand text-on-brand flex items-center justify-center text-base font-bold shrink-0">
            {initial}
          </div>
        )}
        <div className="hidden lg:block min-w-0">
          <p className="text-base font-semibold text-ink truncate">{profile.name || 'Studio'}</p>
          <p className="text-xs text-muted">EasyInvoices24</p>
        </div>
      </div>

      {/* Primary action */}
      <div className="px-3 lg:px-4 pt-2 pb-4">
        <Link
          href="/invoices?new=1"
          title="New invoice"
          className="flex items-center justify-center gap-2 h-12 w-12 lg:w-full mx-auto rounded-full bg-brand text-on-brand text-sm font-semibold shadow-brand hover:bg-brand-hover active:bg-brand-dark transition"
        >
          <Plus weight="bold" className="w-5 h-5 shrink-0" aria-hidden />
          <span className="hidden lg:inline">New invoice</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2 lg:px-3">
        {BOTTOM_TABS.map(({ href, label, icon: NavIcon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex flex-col lg:flex-row items-center gap-1 lg:gap-3 rounded-2xl py-2.5 lg:px-3 transition-colors',
                active
                  ? 'bg-brand-soft text-brand-ink'
                  : 'text-muted hover:bg-subtle hover:text-ink',
              ].join(' ')}
            >
              <NavIcon
                weight="duotone"
                className={`w-6 h-6 shrink-0 ${active ? 'text-brand-ink' : ''}`}
                aria-hidden
              />
              <span
                className={`text-[11px] lg:text-sm leading-none ${active ? 'font-semibold' : 'font-medium'}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Secondary action */}
      <div className="mt-auto px-2 lg:px-3">
        <Link
          href="/clients?new=1"
          title="New client"
          className="flex flex-col lg:flex-row items-center gap-1 lg:gap-3 rounded-2xl py-2.5 lg:px-3 text-muted hover:bg-subtle hover:text-ink transition-colors"
        >
          <UserPlus weight="duotone" className="w-6 h-6 shrink-0" aria-hidden />
          <span className="text-[11px] lg:text-sm font-medium leading-none">New client</span>
        </Link>
      </div>
    </aside>
  );
}

// ── Floating action button (phones) ──────────────────────────────────────────

function MobileFAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleAction(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25 screen-in md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-3 md:hidden"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 14px)' }}
      >
        {open && (
          <div className="flex flex-col items-end gap-2.5">
            {FAB_ACTIONS.map(({ key, label, href, icon: ActionIcon }) => (
              <button
                key={key}
                onClick={() => handleAction(href)}
                className="flex items-center gap-3 h-12 pl-2 pr-5 rounded-full bg-surface shadow-float text-sm font-semibold text-ink transition-all active:scale-95"
              >
                <span className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center">
                  <ActionIcon weight="duotone" className="w-5 h-5 text-brand-ink" aria-hidden />
                </span>
                {label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Create new'}
          className="w-14 h-14 rounded-full bg-brand text-on-brand flex items-center justify-center shadow-brand transition-transform hover:bg-brand-hover active:scale-95"
        >
          <Plus
            weight="bold"
            className={`w-6 h-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
            aria-hidden
          />
        </button>
      </div>
    </>
  );
}

// ── Bottom tab bar ────────────────────────────────────────────────────────────

function BottomTabBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line shadow-[0_-2px_12px_rgb(16_24_40/0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16 max-w-xl mx-auto">
        {BOTTOM_TABS.map(({ href, label, icon: TabIcon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
                active ? 'text-brand-ink' : 'text-faint active:text-ink-2',
              ].join(' ')}
            >
              {active && (
                <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand" aria-hidden />
              )}
              <TabIcon weight="duotone" className="w-6 h-6 shrink-0" aria-hidden />
              <span
                className={`text-[11px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
