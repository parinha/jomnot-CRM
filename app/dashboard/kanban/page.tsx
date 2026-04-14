export const dynamic = 'force-dynamic';

import KanbanView from '@/src/features/projects/components/KanbanView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getProjects } from '@/src/features/projects/api/getProjects';

export default async function KanbanPage() {
  const [projects, clients] = await Promise.all([getProjects(), getClients()]);
  return <KanbanView projects={projects} clients={clients} />;
}
