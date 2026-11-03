import { Suspense } from 'react';
import QuotationsScreen from '@/src/screens/QuotationsScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function QuotationsPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Quotations">
        <Suspense>
          <QuotationsScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
