import { Suspense } from 'react';
import InvoicesScreen from '@/src/screens/InvoicesScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function InvoicesPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Invoices">
        <Suspense>
          <InvoicesScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
