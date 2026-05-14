import { Suspense } from 'react';
import KanbanScreen from '@/src/screens/KanbanScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function KanbanPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Kanban">
        <Suspense>
          <KanbanScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
