import { getCompanyProfile } from '@/src/features/settings/api/getSettings';
import { setDoc } from '@/src/lib/db-mutations';
import type { CompanyProfile } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await getCompanyProfile();
    return Response.json(profile);
  } catch {
    return Response.json({ error: 'Failed to fetch company profile' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile: CompanyProfile = await req.json();
    await setDoc('settings/company', profile as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save company profile' }, { status: 500 });
  }
}
