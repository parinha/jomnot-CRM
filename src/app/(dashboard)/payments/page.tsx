import { Suspense } from 'react';
import PaymentsScreen from '@/src/screens/PaymentsScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function PaymentsPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Payments">
        <Suspense>
          <PaymentsScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
