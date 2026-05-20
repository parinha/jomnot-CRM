'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InvoicePrint from '@/src/components/InvoicePrint';
import { fetchDoc, fetchAll, fetchDocPath } from '@/src/lib/client/firestore';
import { auth } from '@/src/lib/auth';
import type {
  Invoice,
  Client,
  CompanyProfile,
  PaymentInfo,
  PaymentMethod,
  InvoicingSettings,
  AppPreferences,
} from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';

const EMPTY_COMPANY: CompanyProfile = {
  name: '',
  logo: '',
  address: '',
  phone: '',
  website: '',
  signatoryName: '',
  signatorySignature: '',
};

const EMPTY_PAYMENT: PaymentInfo = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  swiftCode: '',
  currency: '',
  qrImage: '',
};

type PrintState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | {
      status: 'ready';
      invoice: Invoice;
      client: Client | null;
      company: CompanyProfile;
      payment: PaymentInfo;
      prefs: AppPreferences;
    };

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PrintState>({ status: 'loading' });

  useEffect(() => {
    async function load() {
      await auth.authStateReady();

      const [invoice, clients, company, invoicing, paymentMethodsDoc] = await Promise.all([
        fetchDoc<Invoice>('invoices', id),
        fetchAll<Client>('clients'),
        fetchDocPath<CompanyProfile>('settings/company'),
        fetchDocPath<Partial<InvoicingSettings>>('settings/invoicing'),
        fetchDocPath<{ methods: PaymentMethod[] }>('settings/paymentMethods'),
      ]);

      if (!invoice) {
        setState({ status: 'not-found' });
        return;
      }

      const inv = invoicing ?? {};
      const methods = paymentMethodsDoc?.methods ?? [];

      const resolvedMethod = invoice.paymentMethodId
        ? methods.find((m) => m.id === invoice.paymentMethodId)
        : methods.find((m) => m.isDefault);

      const payment: PaymentInfo = {
        ...EMPTY_PAYMENT,
        bankName: resolvedMethod?.bankName ?? inv.bankName ?? '',
        accountName: resolvedMethod?.accountName ?? inv.accountName ?? '',
        accountNumber: resolvedMethod?.accountNumber ?? inv.accountNumber ?? '',
        swiftCode: resolvedMethod?.swiftCode ?? inv.swiftCode ?? '',
        currency: resolvedMethod?.currency ?? inv.currency ?? '',
        qrImage: resolvedMethod?.qrImage ?? inv.qrImage ?? '',
      };

      const prefs: AppPreferences = {
        ...DEFAULT_APP_PREFERENCES,
        currencyCode: inv.currencyCode ?? DEFAULT_APP_PREFERENCES.currencyCode,
        currencySymbol: inv.currencySymbol ?? DEFAULT_APP_PREFERENCES.currencySymbol,
        dateFormat: inv.dateFormat ?? DEFAULT_APP_PREFERENCES.dateFormat,
        taxEnabled: inv.taxEnabled ?? DEFAULT_APP_PREFERENCES.taxEnabled,
        taxLabel: inv.taxLabel ?? DEFAULT_APP_PREFERENCES.taxLabel,
        taxRate: inv.taxRate ?? DEFAULT_APP_PREFERENCES.taxRate,
        taxType: inv.taxType ?? DEFAULT_APP_PREFERENCES.taxType,
      };

      setState({
        status: 'ready',
        invoice,
        client: clients.find((c) => c.id === invoice.clientId) ?? null,
        company: company ?? EMPTY_COMPANY,
        payment,
        prefs,
      });
    }

    load().catch(() => setState({ status: 'not-found' }));
  }, [id]);

  if (state.status === 'loading') return null;
  if (state.status === 'not-found') return <p style={{ padding: 32 }}>Invoice not found.</p>;

  return (
    <InvoicePrint
      invoice={state.invoice}
      client={state.client}
      company={state.company}
      payment={state.payment}
      taxLabel={state.prefs.taxLabel}
      taxRate={state.prefs.taxRate}
      taxType={state.prefs.taxType}
      currencyCode={state.prefs.currencyCode}
    />
  );
}
