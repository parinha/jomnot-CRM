export const dynamic = 'force-dynamic';

import InvoicePrint from '@/src/features/invoices/components/InvoicePrint';
import { getInvoice } from '@/src/features/invoices/api/getInvoices';
import { getClients } from '@/src/features/clients/api/getClients';
import { getCompanyProfile, getPaymentInfo } from '@/src/features/settings/api/getSettings';

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, clients, company, payment] = await Promise.all([
    getInvoice(id),
    getClients(),
    getCompanyProfile(),
    getPaymentInfo(),
  ]);
  if (!invoice) return <p style={{ padding: 32 }}>Invoice not found.</p>;
  const client = clients.find((c) => c.id === invoice.clientId) ?? null;
  return <InvoicePrint invoice={invoice} client={client} company={company} payment={payment} />;
}
