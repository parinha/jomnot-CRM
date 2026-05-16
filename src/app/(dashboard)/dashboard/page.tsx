import { Suspense } from 'react';
import DashboardScreen from '@/src/screens/DashboardScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function DashboardPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Dashboard">
        <Suspense>
          <DashboardScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
