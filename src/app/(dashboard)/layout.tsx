import { AuthProvider } from '@/src/components/AuthProvider';
import AuthGuard from '@/src/components/AuthGuard';
import DashboardShell from '@/src/components/Shell';
import { InvoicesProvider } from '@/src/contexts/InvoicesContext';
import { ClientsProvider } from '@/src/contexts/ClientsContext';
import { SettingsProvider } from '@/src/contexts/SettingsContext';
import { QuotationsProvider } from '@/src/contexts/QuotationsContext';
import { ReceiptsProvider } from '@/src/contexts/ReceiptsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <SettingsProvider>
          <InvoicesProvider>
            <QuotationsProvider>
              <ReceiptsProvider>
                <ClientsProvider>
                  <DashboardShell>{children}</DashboardShell>
                </ClientsProvider>
              </ReceiptsProvider>
            </QuotationsProvider>
          </InvoicesProvider>
        </SettingsProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
