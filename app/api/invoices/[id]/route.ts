import { getInvoice } from '@/src/features/invoices/api/getInvoices';
import { deleteDoc, patchDoc } from '@/src/lib/db-mutations';
import type { InvoiceStatus } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(invoice);
  } catch {
    return Response.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteDoc('invoices', id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status }: { status: InvoiceStatus } = await req.json();
    await patchDoc('invoices', id, { status });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to update invoice status' }, { status: 500 });
  }
}
