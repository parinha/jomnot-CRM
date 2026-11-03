import Link from 'next/link';
import type { ReactNode } from 'react';
import { Receipt } from '@phosphor-icons/react/ssr';

/** Shared pill button styles, matching the rest of the app. */
export const statusPrimaryBtn =
  'h-13 w-full rounded-full bg-brand text-on-brand text-base font-semibold hover:bg-brand-hover active:bg-brand-dark transition shadow-brand flex items-center justify-center gap-2';
export const statusSecondaryBtn =
  'h-13 w-full rounded-full bg-subtle text-ink-2 text-base font-semibold hover:bg-line active:bg-line-strong transition flex items-center justify-center gap-2';

/**
 * Full-page status screen (404 / 500) in the login page's style:
 * green brand hero on top, white rounded sheet with the message and actions.
 * Server-safe: pass interactive buttons in from a client component via `actions`.
 */
export default function StatusScreen({
  code,
  icon,
  title,
  text,
  detail,
  actions,
}: {
  code: string;
  icon: ReactNode;
  title: string;
  text: string;
  detail?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="min-h-dvh flex flex-col bg-brand">
      {/* Green hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 pt-12 pb-20 md:pb-24 overflow-hidden"
        style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top, 0px) + 1.5rem))' }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-on-brand/90 hover:text-on-brand transition"
          aria-label="EasyInvoices24 home"
        >
          <span className="w-9 h-9 rounded-2xl bg-white flex items-center justify-center shadow-float">
            <Receipt className="w-5 h-5 text-brand-ink" weight="duotone" aria-hidden />
          </span>
          <span className="text-lg font-semibold">EasyInvoices24</span>
        </Link>
        <p
          className="mt-6 text-[96px] md:text-[128px] leading-none font-semibold text-on-brand tracking-tight select-none"
          aria-hidden
        >
          {code}
        </p>
      </div>

      {/* White sheet */}
      <div
        className="flex-1 bg-surface rounded-t-[32px] px-6 -mt-6 md:-mt-8"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center">
          <div className="-mt-10 w-20 h-20 rounded-full bg-brand-soft ring-8 ring-surface flex items-center justify-center">
            {icon}
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted max-w-xs">{text}</p>
          {detail && <div className="mt-4 w-full">{detail}</div>}
          <div className="mt-8 w-full flex flex-col gap-3">{actions}</div>
        </div>
      </div>
    </main>
  );
}
