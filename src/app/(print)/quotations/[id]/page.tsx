'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuotationPrint from '@/src/components/QuotationPrint';
import { fetchDoc, fetchAll, fetchDocPath } from '@/src/lib/client/firestore';
import { auth } from '@/src/lib/auth';
import type {
  Quotation,
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

type PrintState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | {
      status: 'ready';
      quote: Quotation;
      client: Client | null;
      company: CompanyProfile;
      payment: PaymentInfo;
      currencyCode: string;
      dateFormat: AppPreferences['dateFormat'];
    };

export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PrintState>({ status: 'loading' });

  useEffect(() => {
    async function load() {
      await auth.authStateReady();

      const [quote, clients, company, invoicing, paymentMethodsDoc, preferences] =
        await Promise.all([
          fetchDoc<Quotation>('quotations', id),
          fetchAll<Client>('clients'),
          fetchDocPath<CompanyProfile>('settings/company'),
          fetchDocPath<Partial<InvoicingSettings>>('settings/invoicing'),
          fetchDocPath<{ methods: PaymentMethod[] }>('settings/paymentMethods'),
          fetchDocPath<Partial<PaymentInfo>>('settings/preferences'),
        ]);

      if (!quote) {
        setState({ status: 'not-found' });
        return;
      }

      const inv = invoicing ?? {};
      const methods = paymentMethodsDoc?.methods ?? [];
      const method = quote.paymentMethodId
        ? methods.find((m) => m.id === quote.paymentMethodId)
        : methods.find((m) => m.isDefault);

      const payment: PaymentInfo = {
        bankName: method?.bankName ?? inv.bankName ?? '',
        accountName: method?.accountName ?? inv.accountName ?? '',
        accountNumber: method?.accountNumber ?? inv.accountNumber ?? '',
        swiftCode: method?.swiftCode ?? inv.swiftCode ?? '',
        currency: method?.currency ?? inv.currency ?? '',
        qrImage: method?.qrImage ?? inv.qrImage ?? '',
        telegramBotToken: preferences?.telegramBotToken,
        telegramChatId: preferences?.telegramChatId,
        telegramTopicId: preferences?.telegramTopicId,
        telegramQuoteChatId: preferences?.telegramQuoteChatId,
        telegramQuoteTopicId: preferences?.telegramQuoteTopicId,
      };

      setState({
        status: 'ready',
        quote,
        client: clients.find((c) => c.id === quote.clientId) ?? null,
        company: company ?? EMPTY_COMPANY,
        payment,
        currencyCode: inv.currencyCode ?? DEFAULT_APP_PREFERENCES.currencyCode,
        dateFormat: inv.dateFormat ?? DEFAULT_APP_PREFERENCES.dateFormat,
      });
    }

    load().catch(() => setState({ status: 'not-found' }));
  }, [id]);

  if (state.status === 'loading') return null;
  if (state.status === 'not-found') return <p style={{ padding: 32 }}>Quotation not found.</p>;

  return (
    <QuotationPrint
      quote={state.quote}
      client={state.client}
      company={state.company}
      payment={state.payment}
      currencyCode={state.currencyCode}
      dateFormat={state.dateFormat}
    />
  );
}
