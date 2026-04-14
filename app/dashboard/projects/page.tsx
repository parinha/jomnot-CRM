export const dynamic = 'force-dynamic';

import ProjectsView from '@/src/features/projects/components/ProjectsView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { getProjects } from '@/src/features/projects/api/getProjects';
import { getPaymentInfo, getScopeOfWork } from '@/src/features/settings/api/getSettings';

export default async function ProjectsPage() {
  const [clients, invoices, projects, scopeOfWork, paymentInfo] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
    getScopeOfWork(),
    getPaymentInfo(),
  ]);
  return (
    <ProjectsView
      clients={clients}
      invoices={invoices}
      projects={projects}
      scopeOfWork={scopeOfWork}
      paymentInfo={paymentInfo}
    />
  );
}
