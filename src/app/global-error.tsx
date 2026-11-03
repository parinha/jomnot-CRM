'use client';

// Replaces the root layout when it crashes, so it brings its own <html>, styles and fonts.
import './globals.css';
import ErrorScreen from '@/src/components/ErrorScreen';
import { fontVariables } from './fonts';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <title>Something went wrong · EasyInvoices24</title>
        <ErrorScreen error={error} retry={unstable_retry} />
      </body>
    </html>
  );
}
