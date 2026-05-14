import { Suspense } from 'react';
import ClientsScreen from '@/src/screens/ClientsScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function ClientsPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Clients">
        <Suspense>
          <ClientsScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
