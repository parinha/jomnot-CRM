'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReceiptPrint from '@/src/components/ReceiptPrint';
import { fetchDoc, fetchDocPath } from '@/src/lib/client/firestore';
import { auth } from '@/src/lib/auth';
import type {
  AppPreferences,
  Client,
  CompanyProfile,
  Invoice,
  InvoicingSettings,
  PaymentInfo,
  Receipt,
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
      receipt: Receipt;
      invoice: Invoice | null;
      client: Client | null;
      company: CompanyProfile;
      payment: PaymentInfo;
      prefs: AppPreferences;
    };

export default function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PrintState>({ status: 'loading' });

  useEffect(() => {
    async function load() {
      await auth.authStateReady();

      const receipt = await fetchDoc<Receipt>('receipts', id);
      if (!receipt) {
        setState({ status: 'not-found' });
        return;
      }

      const [invoice, client, company, invoicing, preferences] = await Promise.all([
        fetchDoc<Invoice>('invoices', receipt.invoiceId),
        fetchDoc<Client>('clients', receipt.clientId),
        fetchDocPath<CompanyProfile>('settings/company'),
        fetchDocPath<Partial<InvoicingSettings>>('settings/invoicing'),
        fetchDocPath<Partial<PaymentInfo>>('settings/preferences'),
      ]);

      const inv = invoicing ?? {};
      setState({
        status: 'ready',
        receipt,
        invoice,
        client,
        company: company ?? EMPTY_COMPANY,
        payment: {
          bankName: '',
          accountName: '',
          accountNumber: '',
          swiftCode: '',
          currency: '',
          qrImage: '',
          telegramBotToken: preferences?.telegramBotToken,
          telegramChatId: preferences?.telegramChatId,
          telegramTopicId: preferences?.telegramTopicId,
          telegramReceiptChatId: preferences?.telegramReceiptChatId,
          telegramReceiptTopicId: preferences?.telegramReceiptTopicId,
        },
        prefs: {
          ...DEFAULT_APP_PREFERENCES,
          currencyCode: inv.currencyCode ?? DEFAULT_APP_PREFERENCES.currencyCode,
          dateFormat: inv.dateFormat ?? DEFAULT_APP_PREFERENCES.dateFormat,
          taxLabel: inv.taxLabel ?? DEFAULT_APP_PREFERENCES.taxLabel,
          taxRate: inv.taxRate ?? DEFAULT_APP_PREFERENCES.taxRate,
          taxType: inv.taxType ?? DEFAULT_APP_PREFERENCES.taxType,
        },
      });
    }

    load().catch(() => setState({ status: 'not-found' }));
  }, [id]);

  if (state.status === 'loading') return null;
  if (state.status === 'not-found') return <p style={{ padding: 32 }}>Receipt not found.</p>;

  return (
    <ReceiptPrint
      receipt={state.receipt}
      invoice={state.invoice}
      client={state.client}
      company={state.company}
      payment={state.payment}
      taxLabel={state.prefs.taxLabel}
      taxRate={state.prefs.taxRate}
      taxType={state.prefs.taxType}
      currencyCode={state.prefs.currencyCode}
      dateFormat={state.prefs.dateFormat}
    />
  );
}
