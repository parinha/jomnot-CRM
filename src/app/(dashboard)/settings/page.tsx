import { Suspense } from 'react';
import SettingsScreen from '@/src/screens/SettingsScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function SettingsPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Settings">
        <Suspense>
          <SettingsScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
