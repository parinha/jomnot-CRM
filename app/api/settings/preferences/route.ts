import { getAppPreferences } from '@/src/features/settings/api/getSettings';
import { mergeDoc } from '@/src/lib/db-mutations';
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
    // Merge only workspace fields — telegram fields also live in this doc and must not be overwritten
    const workspaceFields = {
      kanbanPhases: prefs.kanbanPhases,
      holidays: prefs.holidays,
    };
    await mergeDoc('settings/preferences', workspaceFields as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
