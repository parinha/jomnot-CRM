import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebase-admin';
import { buildProjectsSummaryMessage, sendTelegramMessage } from '@/src/lib/telegram-messages';
import type { Project, PaymentInfo } from '@/src/types';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');

  const authorized =
    cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      return NextResponse.json(
        { error: 'Telegram credentials not configured in settings' },
        { status: 400 }
      );
    }

    const text = buildProjectsSummaryMessage(projects);
    const result = await sendTelegramMessage(
      token,
      chatId,
      text,
      payment?.projectTelegramTopicId?.trim()
    );

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
