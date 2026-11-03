'use client';

import ErrorScreen from '@/src/components/ErrorScreen';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorScreen error={error} retry={unstable_retry} />;
}
