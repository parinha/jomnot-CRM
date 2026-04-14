export const dynamic = 'force-dynamic';

import TimelineView from '@/src/features/projects/components/TimelineView';
import { getProjects } from '@/src/features/projects/api/getProjects';

export default async function TimelinePage() {
  const projects = await getProjects();
  return <TimelineView projects={projects} />;
}
