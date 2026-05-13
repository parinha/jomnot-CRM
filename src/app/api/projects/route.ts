import { getProjects } from '@/src/features/projects/api/getProjects';
import { upsertDoc } from '@/src/lib/db-mutations';
import { adminDb } from '@/src/lib/firebase-admin';
import { buildNewProjectMessage, sendTelegramMessage } from '@/src/lib/telegram-messages';
import type { Project, PaymentInfo } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await getProjects();
    return Response.json(projects);
  } catch {
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const project: Project = await req.json();
    const { isNew } = await upsertDoc(
      'projects',
      project.id,
      project as unknown as Record<string, unknown>
    );

    // Fire-and-forget Telegram notification for new projects
    if (isNew) {
      void notifyNewProject(project);
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save project' }, { status: 500 });
  }
}

async function notifyNewProject(project: Project): Promise<void> {
  try {
    const [projectsSnap, paymentSnap] = await Promise.all([
      adminDb.collection('projects').get(),
      adminDb.doc('settings/payment').get(),
    ]);

    const payment = paymentSnap.exists ? (paymentSnap.data() as PaymentInfo) : null;
    const token = payment?.telegramBotToken?.trim();
    const chatId = payment?.projectTelegramChatId?.trim();
    if (!token || !chatId) return;

    const allProjects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
    const totalActive = allProjects.filter((p) => p.status === 'confirmed').length;
    const totalUnconf = allProjects.filter((p) => p.status === 'unconfirmed').length;
    const text = buildNewProjectMessage(project, totalActive, totalUnconf);

    await sendTelegramMessage(token, chatId, text, payment?.projectTelegramTopicId?.trim());
  } catch {
    // fire-and-forget — never throw
  }
}
