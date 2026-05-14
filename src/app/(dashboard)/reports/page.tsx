import { Suspense } from 'react';
import ReportsScreen from '@/src/screens/ReportsScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function ReportsPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Reports">
        <Suspense>
          <ReportsScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
