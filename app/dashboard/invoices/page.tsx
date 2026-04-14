export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import InvoicesView from '@/src/features/invoices/components/InvoicesView';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { getProjects } from '@/src/features/projects/api/getProjects';
import {
  getCompanyProfile,
  getPaymentInfo,
  getScopeOfWork,
} from '@/src/features/settings/api/getSettings';

export default async function InvoicesPage() {
  const [clients, invoices, projects, scopeOfWork, companyProfile, paymentInfo] = await Promise.all(
    [
      getClients(),
      getInvoices(),
      getProjects(),
      getScopeOfWork(),
      getCompanyProfile(),
      getPaymentInfo(),
    ]
  );
  return (
    <Suspense>
      <InvoicesView
        clients={clients}
        invoices={invoices}
        projects={projects}
        scopeOfWork={scopeOfWork}
        companyProfile={companyProfile}
        paymentInfo={paymentInfo}
      />
    </Suspense>
  );
}
