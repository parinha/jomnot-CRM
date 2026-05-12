import { AuthProvider } from '@/src/features/auth/components/AuthProvider';
import AuthGuard from '@/src/features/auth/components/AuthGuard';
import DashboardShell from '@/src/features/dashboard/components/DashboardShell';
import { InvoicesProvider } from '@/src/contexts/InvoicesContext';
import { ClientsProvider } from '@/src/contexts/ClientsContext';
import { ProjectsProvider } from '@/src/contexts/ProjectsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <InvoicesProvider>
          <ClientsProvider>
            <ProjectsProvider>
              <DashboardShell>{children}</DashboardShell>
            </ProjectsProvider>
          </ClientsProvider>
        </InvoicesProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
