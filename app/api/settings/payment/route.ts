import { getPaymentInfo } from '@/src/features/settings/api/getSettings';
import { mergeDoc } from '@/src/lib/db-mutations';
import type { PaymentInfo } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payment = await getPaymentInfo();
    return Response.json(payment);
  } catch {
    return Response.json({ error: 'Failed to fetch payment info' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payment: PaymentInfo = await req.json();
    // Telegram/integration fields are stored in settings/preferences alongside workspace data.
    // Use merge so workspace fields (kanbanPhases etc.) are not overwritten.
    const telegramFields = {
      telegramBotToken: payment.telegramBotToken,
      telegramChatId: payment.telegramChatId,
      telegramTopicId: payment.telegramTopicId,
      projectTelegramChatId: payment.projectTelegramChatId,
      projectTelegramTopicId: payment.projectTelegramTopicId,
      kanbanUpdateEnabled: payment.kanbanUpdateEnabled,
      kanbanUpdateTimes: payment.kanbanUpdateTimes,
      kanbanUpdateDays: payment.kanbanUpdateDays,
      kanbanUpdateTimezone: payment.kanbanUpdateTimezone,
      telegramTemplate: payment.telegramTemplate,
    };
    await mergeDoc('settings/preferences', telegramFields as unknown as Record<string, unknown>);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed to save payment info' }, { status: 500 });
  }
}
