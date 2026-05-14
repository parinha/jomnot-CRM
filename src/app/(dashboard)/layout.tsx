import { AuthProvider } from '@/src/components/AuthProvider';
import AuthGuard from '@/src/components/AuthGuard';
import DashboardShell from '@/src/components/Shell';
import { InvoicesProvider } from '@/src/contexts/InvoicesContext';
import { ClientsProvider } from '@/src/contexts/ClientsContext';
import { ProjectsProvider } from '@/src/contexts/ProjectsContext';
import { SettingsProvider } from '@/src/contexts/SettingsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <SettingsProvider>
          <InvoicesProvider>
            <ClientsProvider>
              <ProjectsProvider>
                <DashboardShell>{children}</DashboardShell>
              </ProjectsProvider>
            </ClientsProvider>
          </InvoicesProvider>
        </SettingsProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
