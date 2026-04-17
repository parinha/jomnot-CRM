import { AuthProvider } from '@/src/features/auth/components/AuthProvider';
import AuthGuard from '@/src/features/auth/components/AuthGuard';
import DashboardShell from '@/src/features/dashboard/components/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <DashboardShell>{children}</DashboardShell>
      </AuthGuard>
    </AuthProvider>
  );
}
