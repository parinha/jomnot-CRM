export const dynamic = 'force-dynamic';

import PaymentsView from '@/src/features/payments/components/PaymentsView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';

export default async function PaymentsPage() {
  const [invoices, clients] = await Promise.all([getInvoices(), getClients()]);
  return <PaymentsView invoices={invoices} clients={clients} />;
}
