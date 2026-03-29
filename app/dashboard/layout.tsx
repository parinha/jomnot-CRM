import { AppStoreProvider } from './AppStore'
import DashboardShell from './DashboardShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStoreProvider>
      <DashboardShell>{children}</DashboardShell>
    </AppStoreProvider>
  )
}
