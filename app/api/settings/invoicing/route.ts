import { getInvoicingSettings } from '@/src/features/settings/api/getSettings';
import { setDoc } from '@/src/lib/db-mutations';
import type { InvoicingSettings } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const invoicing = await getInvoicingSettings();
    return Response.json(invoicing);
  } catch {
    return Response.json({ error: 'Failed to fetch invoicing settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const invoicing: InvoicingSettings = await req.json();
    await setDoc('settings/invoicing', invoicing as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save invoicing settings' }, { status: 500 });
  }
}
