import { Suspense } from 'react';
import InvoicesView from '@/src/features/invoices/components/InvoicesView';

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesView />
    </Suspense>
  );
}
