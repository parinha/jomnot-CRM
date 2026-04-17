import { getClients } from '@/src/features/clients/api/getClients';
import { upsertDoc } from '@/src/lib/db-mutations';
import type { Client } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clients = await getClients();
    return Response.json(clients);
  } catch {
    return Response.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const client: Client = await req.json();
    await upsertDoc('clients', client.id, client as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save client' }, { status: 500 });
  }
}
