import { adminDb } from '@/src/lib/firebase-admin';
import { buildProjectsSummaryMessage, sendTelegramMessage } from '@/src/lib/telegram-messages';
import type { Project } from '@/src/types';
import { getPaymentInfo, getAppPreferences } from '@/src/features/settings/api/getSettings';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const [projectsSnap, payment, prefs] = await Promise.all([
      adminDb.collection('projects').get(),
      getPaymentInfo(),
      getAppPreferences(),
    ]);

    const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);

    const token = payment.telegramBotToken?.trim();
    const chatId = payment.projectTelegramChatId?.trim();

    if (!token || !chatId) {
      return Response.json(
        { ok: false, error: 'Add your Telegram Bot Token and Project Chat ID in Settings first.' },
        { status: 400 }
      );
    }

    const text = buildProjectsSummaryMessage(
      projects,
      prefs.kanbanPhases,
      payment.telegramTemplate
    );
    const result = await sendTelegramMessage(
      token,
      chatId,
      text,
      payment.projectTelegramTopicId?.trim()
    );

    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 502 });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
