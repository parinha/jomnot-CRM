import { deleteDoc } from '@/src/lib/db-mutations';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteDoc('clients', id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
