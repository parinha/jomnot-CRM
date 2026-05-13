'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import ClientsScreen from '@/src/screens/ClientsScreen';
import InvoicesScreen from '@/src/screens/InvoicesScreen';
import ProjectsScreen from '@/src/screens/ProjectsScreen';
import KanbanScreen from '@/src/screens/KanbanScreen';
import TimelineScreen from '@/src/screens/TimelineScreen';
import PaymentsScreen from '@/src/screens/PaymentsScreen';
import ReportsScreen from '@/src/screens/ReportsScreen';
import SettingsScreen from '@/src/screens/SettingsScreen';

export default function DashboardPage() {
  const pathname = usePathname() ?? '';

  if (pathname.startsWith('/dashboard/invoices'))
    return (
      <Suspense>
        <InvoicesScreen />
      </Suspense>
    );
  if (pathname.startsWith('/dashboard/settings'))
    return (
      <Suspense>
        <SettingsScreen />
      </Suspense>
    );
  if (pathname.startsWith('/dashboard/clients')) return <ClientsScreen />;
  if (pathname.startsWith('/dashboard/projects')) return <ProjectsScreen />;
  if (pathname.startsWith('/dashboard/kanban')) return <KanbanScreen />;
  if (pathname.startsWith('/dashboard/timeline')) return <TimelineScreen />;
  if (pathname.startsWith('/dashboard/payments')) return <PaymentsScreen />;
  if (pathname.startsWith('/dashboard/reports')) return <ReportsScreen />;

  return <ClientsScreen />;
}
