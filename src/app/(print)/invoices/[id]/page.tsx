export const dynamic = 'force-dynamic';

import InvoicePrint from '@/src/components/InvoicePrint';
import { getInvoice } from '@/src/lib/server/invoices';
import { getClients } from '@/src/lib/server/clients';
import {
  getCompanyProfile,
  getPaymentInfo,
  getInvoicingSettings,
  getAppPreferences,
} from '@/src/lib/server/settings';

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, clients, company, payment, invoicing, prefs] = await Promise.all([
    getInvoice(id),
    getClients(),
    getCompanyProfile(),
    getPaymentInfo(),
    getInvoicingSettings(),
    getAppPreferences(),
  ]);
  if (!invoice) return <p style={{ padding: 32 }}>Invoice not found.</p>;
  const client = clients.find((c) => c.id === invoice.clientId) ?? null;
  const mergedPayment = {
    ...payment,
    bankName: invoicing.bankName,
    accountName: invoicing.accountName,
    accountNumber: invoicing.accountNumber,
    swiftCode: invoicing.swiftCode,
    currency: invoicing.currency,
    qrImage: invoicing.qrImage,
  };
  return (
    <InvoicePrint
      invoice={invoice}
      client={client}
      company={company}
      payment={mergedPayment}
      taxLabel={prefs.taxLabel}
      taxRate={prefs.taxRate}
      taxType={prefs.taxType}
      currencyCode={prefs.currencyCode}
    />
  );
}
