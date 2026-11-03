import { AuthProvider } from '@/src/components/AuthProvider';
import AuthGuard from '@/src/components/AuthGuard';
import DashboardShell from '@/src/components/Shell';
import { InvoicesProvider } from '@/src/contexts/InvoicesContext';
import { ClientsProvider } from '@/src/contexts/ClientsContext';
import { SettingsProvider } from '@/src/contexts/SettingsContext';
import { QuotationsProvider } from '@/src/contexts/QuotationsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <SettingsProvider>
          <InvoicesProvider>
            <QuotationsProvider>
              <ClientsProvider>
                <DashboardShell>{children}</DashboardShell>
              </ClientsProvider>
            </QuotationsProvider>
          </InvoicesProvider>
        </SettingsProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
