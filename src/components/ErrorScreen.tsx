'use client';

import { ArrowClockwise, House, WarningCircle } from '@phosphor-icons/react';
import { useEffect } from 'react';
import StatusScreen, { statusPrimaryBtn, statusSecondaryBtn } from '@/src/components/StatusScreen';

/** 500 screen shared by app/error.tsx and app/global-error.tsx. */
export default function ErrorScreen({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      code="500"
      icon={<WarningCircle className="w-10 h-10 text-brand-ink" weight="duotone" aria-hidden />}
      title="Something went wrong"
      text="An unexpected error occurred on our side. Please try again — your invoices and data are safe."
      detail={
        error.digest ? (
          <p className="text-xs text-faint">
            Error ID <span className="font-mono text-ink-2">{error.digest}</span>
          </p>
        ) : undefined
      }
      actions={
        <>
          <button type="button" onClick={retry} className={statusPrimaryBtn}>
            <ArrowClockwise className="w-5 h-5" weight="bold" aria-hidden />
            Try again
          </button>
          {/* Full page load (not <Link>) so a broken client state is fully reset */}
          <a href="/dashboard" className={statusSecondaryBtn}>
            <House className="w-5 h-5" weight="duotone" aria-hidden />
            Go to Home
          </a>
        </>
      }
    />
  );
}
