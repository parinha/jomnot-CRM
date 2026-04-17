import { getInvoices } from '@/src/features/invoices/api/getInvoices';
import { upsertDoc } from '@/src/lib/db-mutations';
import type { Invoice } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const invoices = await getInvoices();
    return Response.json(invoices);
  } catch {
    return Response.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const invoice: Invoice = await req.json();
    await upsertDoc('invoices', invoice.id, invoice as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save invoice' }, { status: 500 });
  }
}
