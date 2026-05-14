import { Suspense } from 'react';
import TimelineScreen from '@/src/screens/TimelineScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function TimelinePage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Timeline">
        <Suspense>
          <TimelineScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
