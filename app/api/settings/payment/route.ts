import { getPaymentInfo } from '@/src/features/settings/api/getSettings';
import { setDoc } from '@/src/lib/db-mutations';
import type { PaymentInfo } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payment = await getPaymentInfo();
    return Response.json(payment);
  } catch {
    return Response.json({ error: 'Failed to fetch payment info' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payment: PaymentInfo = await req.json();
    await setDoc('settings/payment', payment as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save payment info' }, { status: 500 });
  }
}
