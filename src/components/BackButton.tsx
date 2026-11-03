'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

/** Goes back in history, or home when there is no previous page (e.g. opened from a link). */
export default function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/dashboard'))}
    >
      <ArrowLeft className="w-5 h-5" weight="bold" aria-hidden />
      Go back
    </button>
  );
}
