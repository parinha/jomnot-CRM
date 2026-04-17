import { getScopeOfWork } from '@/src/features/settings/api/getSettings';
import { setDoc } from '@/src/lib/db-mutations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const scopes = await getScopeOfWork();
    return Response.json(scopes);
  } catch {
    return Response.json({ error: 'Failed to fetch scope of work' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { items }: { items: string[] } = await req.json();
    await setDoc('settings/scopes', { items });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save scope of work' }, { status: 500 });
  }
}
