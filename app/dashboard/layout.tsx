export const dynamic = 'force-dynamic';

import { AuthProvider } from '@/src/features/auth/components/AuthProvider';
import AuthGuard from '@/src/features/auth/components/AuthGuard';
import DashboardShell from '@/src/features/dashboard/components/DashboardShell';
import { getClients } from '@/src/features/clients/api/getClients';
import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { getCompanyProfile } from '@/src/features/settings/api/getSettings';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [clients, invoices, companyProfile] = await Promise.all([
    getClients(),
    getInvoices(),
    getCompanyProfile(),
  ]);

  return (
    <AuthProvider>
      <AuthGuard>
        <DashboardShell clients={clients} invoices={invoices} companyProfile={companyProfile}>
          {children}
        </DashboardShell>
      </AuthGuard>
    </AuthProvider>
  );
}
