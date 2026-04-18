import { getAppPreferences } from '@/src/features/settings/api/getSettings';
import { setDoc } from '@/src/lib/db-mutations';
import type { AppPreferences } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prefs = await getAppPreferences();
    return Response.json(prefs);
  } catch {
    return Response.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const prefs: AppPreferences = await req.json();
    await setDoc('settings/preferences', prefs as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
