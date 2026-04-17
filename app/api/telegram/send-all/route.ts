import { adminDb } from '@/src/lib/firebase-admin';
import {
  buildProjectsSummaryMessage,
  resolveTemplate,
  sendTelegramMessage,
} from '@/src/lib/telegram-messages';
import type { Project, PaymentInfo } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const [projectsSnap, paymentSnap] = await Promise.all([
      adminDb.collection('projects').get(),
      adminDb.doc('settings/payment').get(),
    ]);

    const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
    const payment = paymentSnap.exists ? (paymentSnap.data() as PaymentInfo) : null;

    const token = payment?.telegramBotToken?.trim();
    const chatId = payment?.projectTelegramChatId?.trim();

    if (!token || !chatId) {
      return Response.json(
        { ok: false, error: 'Add your Telegram Bot Token and Project Chat ID in Settings first.' },
        { status: 400 }
      );
    }

    const tpl = resolveTemplate(payment ?? ({} as PaymentInfo));
    const text = buildProjectsSummaryMessage(projects, tpl);
    const result = await sendTelegramMessage(
      token,
      chatId,
      text,
      payment?.projectTelegramTopicId?.trim()
    );

    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 502 });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
