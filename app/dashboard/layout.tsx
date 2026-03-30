import { AuthProvider } from '@/app/_context/AuthContext'
import { AppStoreProvider } from './AppStore'
import DashboardShell from './DashboardShell'
import AuthGuard from './AuthGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <AppStoreProvider>
          <DashboardShell>{children}</DashboardShell>
        </AppStoreProvider>
      </AuthGuard>
    </AuthProvider>
  )
}
