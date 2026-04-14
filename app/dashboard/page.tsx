export const dynamic = 'force-dynamic';

import DashboardView from '@/src/features/dashboard/components/DashboardView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { getProjects } from '@/src/features/projects/api/getProjects';

export default async function DashboardPage() {
  const [clients, invoices, projects] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
  ]);
  return <DashboardView clients={clients} invoices={invoices} projects={projects} />;
}
