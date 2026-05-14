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
import ScreenErrorBoundary from '@/src/components/ScreenErrorBoundary';

export default function DashboardPage() {
  const pathname = usePathname() ?? '';

  if (pathname.startsWith('/dashboard/invoices'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Invoices">
          <Suspense>
            <InvoicesScreen />
          </Suspense>
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/settings'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Settings">
          <Suspense>
            <SettingsScreen />
          </Suspense>
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/clients'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Clients">
          <ClientsScreen />
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/projects'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Projects">
          <ProjectsScreen />
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/kanban'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Kanban">
          <KanbanScreen />
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/timeline'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Timeline">
          <TimelineScreen />
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/payments'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Payments">
          <PaymentsScreen />
        </ScreenErrorBoundary>
      </div>
    );
  if (pathname.startsWith('/dashboard/reports'))
    return (
      <div className="screen-in">
        <ScreenErrorBoundary screenName="Reports">
          <ReportsScreen />
        </ScreenErrorBoundary>
      </div>
    );

  return (
    <div className="screen-in">
      <ScreenErrorBoundary screenName="Invoices">
        <Suspense>
          <InvoicesScreen />
        </Suspense>
      </ScreenErrorBoundary>
    </div>
  );
}
