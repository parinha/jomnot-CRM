import { deleteDoc, patchDoc } from '@/src/lib/db-mutations';
import type { ProjectItem, ProjectPhases } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteDoc('projects', id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: { items?: ProjectItem[]; phases?: ProjectPhases } = await req.json();
    await patchDoc('projects', id, body);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
