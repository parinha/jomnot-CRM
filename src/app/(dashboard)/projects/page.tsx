import { Suspense } from 'react';
import ProjectsScreen from '@/src/screens/ProjectsScreen';
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function ProjectsPage() {
  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Projects">
        <Suspense>
          <ProjectsScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
