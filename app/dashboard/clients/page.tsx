export const dynamic = 'force-dynamic';

import ClientsView from '@/src/features/clients/components/ClientsView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { getProjects } from '@/src/features/projects/api/getProjects';

export default async function ClientsPage() {
  const [clients, invoices, projects] = await Promise.all([
    getClients(),
    getInvoices(),
    getProjects(),
  ]);
  return <ClientsView clients={clients} invoices={invoices} projects={projects} />;
}
