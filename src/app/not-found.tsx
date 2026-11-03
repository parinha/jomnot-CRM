import type { Metadata } from 'next';
import Link from 'next/link';
import { House, MagnifyingGlass } from '@phosphor-icons/react/ssr';
import BackButton from '@/src/components/BackButton';
import StatusScreen, { statusPrimaryBtn, statusSecondaryBtn } from '@/src/components/StatusScreen';

export const metadata: Metadata = {
  title: 'Page not found · EasyInvoices24',
};

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      icon={<MagnifyingGlass className="w-10 h-10 text-brand" weight="duotone" aria-hidden />}
      title="Page not found"
      text="The page you're looking for doesn't exist or may have been moved."
      actions={
        <>
          <Link href="/dashboard" className={statusPrimaryBtn}>
            <House className="w-5 h-5" weight="duotone" aria-hidden />
            Go to Home
          </Link>
          <BackButton className={statusSecondaryBtn} />
        </>
      }
    />
  );
}
