import { AuthProvider } from '@/src/components/AuthProvider';
import AuthGuard from '@/src/components/AuthGuard';
import DashboardShell from '@/src/components/Shell';
import { InvoicesProvider } from '@/src/contexts/InvoicesContext';
import { ClientsProvider } from '@/src/contexts/ClientsContext';
import { SettingsProvider } from '@/src/contexts/SettingsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <SettingsProvider>
          <InvoicesProvider>
            <ClientsProvider>
              <DashboardShell>{children}</DashboardShell>
            </ClientsProvider>
          </InvoicesProvider>
        </SettingsProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
