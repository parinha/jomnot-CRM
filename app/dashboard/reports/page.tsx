export const dynamic = 'force-dynamic';

import ReportsView from '@/src/features/reports/components/ReportsView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { getProjects } from '@/src/features/projects/api/getProjects';

export default async function ReportsPage() {
  const [invoices, clients, projects] = await Promise.all([
    getInvoices(),
    getClients(),
    getProjects(),
  ]);
  return <ReportsView invoices={invoices} clients={clients} projects={projects} />;
}
