import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebase-admin';
import { buildProjectsSummaryMessage, sendTelegramMessage } from '@/src/lib/telegram-messages';
import type { Project, PaymentInfo, AppPreferences } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';

function isScheduledNow(payment: PaymentInfo): boolean {
  if (!payment.kanbanUpdateEnabled) return false;

  const times = payment.kanbanUpdateTimes ?? [];
  const days = payment.kanbanUpdateDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'];
  const tz = payment.kanbanUpdateTimezone ?? 'UTC';

  if (times.length === 0) return false;

  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(now);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const weekday =
      parts
        .find((p) => p.type === 'weekday')
        ?.value?.toLowerCase()
        .slice(0, 3) ?? '';

    if (!days.includes(weekday)) return false;
    return times.some((t) => Number(t.split(':')[0]) === hour);
  } catch {
    return false;
  }
}

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
    const [projectsSnap, prefsSnap] = await Promise.all([
      adminDb.collection('projects').get(),
      adminDb.doc('settings/preferences').get(),
    ]);

    const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
    const prefsData = prefsSnap.exists ? (prefsSnap.data() as Record<string, unknown>) : {};
    // Telegram fields and workspace fields both live in settings/preferences
    const payment = prefsSnap.exists ? (prefsData as unknown as PaymentInfo) : null;
    const prefs: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      ...(prefsData as Partial<AppPreferences>),
    };

    if (!payment || !isScheduledNow(payment)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const token = payment.telegramBotToken?.trim();
    const chatId = payment.projectTelegramChatId?.trim();

    if (!token || !chatId) {
      return NextResponse.json(
        { error: 'Telegram credentials not configured in settings' },
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

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
