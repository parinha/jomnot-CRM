import type { NextRequest } from 'next/server';
import { adminDb } from '@/src/lib/server/firebase-admin';
import { buildProjectsSummaryMessage, sendTelegramMessage } from '@/src/lib/telegram-messages';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import type { KanbanPhase, Project, TelegramKanbanTemplate } from '@/src/types';

function getCurrentHHMM(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).formatToParts(new Date());
  const hh = (parts.find((p) => p.type === 'hour')?.value ?? '00').replace('24', '00');
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
}

function getCurrentDayShort(tz: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz })
    .format(new Date())
    .toLowerCase()
    .slice(0, 3);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromHeader = req.headers.get('authorization') === `Bearer ${secret}`;
  const fromQuery = new URL(req.url).searchParams.get('secret') === secret;
  if (!fromHeader && !fromQuery) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefSnap = await adminDb.doc('settings/preferences').get();
  if (!prefSnap.exists) return Response.json({ skipped: 'no settings' });

  const prefs = prefSnap.data()!;
  if (!prefs.kanbanUpdateEnabled) return Response.json({ skipped: 'disabled' });

  const tz: string = prefs.kanbanUpdateTimezone ?? 'UTC';
  const times: string[] = prefs.kanbanUpdateTimes ?? ['09:00'];
  const days: string[] = prefs.kanbanUpdateDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'];

  const currentDay = getCurrentDayShort(tz);
  if (!days.includes(currentDay)) {
    return Response.json({ skipped: 'not a scheduled day', day: currentDay });
  }

  const currentHHMM = getCurrentHHMM(tz);
  if (!times.includes(currentHHMM)) {
    return Response.json({ skipped: 'no matching time', current: currentHHMM, times });
  }

  // Dedup: skip if already sent within the last 30 minutes
  const lastSentAt: string | undefined = prefs.kanbanUpdateLastSentAt;
  if (lastSentAt && Date.now() - new Date(lastSentAt).getTime() < 30 * 60 * 1000) {
    return Response.json({ skipped: 'already sent recently', lastSentAt });
  }

  const token: string = prefs.telegramBotToken?.trim() ?? '';
  const chatId: string = prefs.projectTelegramChatId?.trim() ?? '';
  if (!token || !chatId) {
    return Response.json(
      { error: 'missing telegramBotToken or projectTelegramChatId' },
      { status: 400 }
    );
  }

  const projSnap = await adminDb.collection('projects').get();
  const projects = projSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);

  const kanbanPhases: KanbanPhase[] = prefs.kanbanPhases ?? DEFAULT_APP_PREFERENCES.kanbanPhases;
  const template: TelegramKanbanTemplate | undefined = prefs.telegramTemplate;
  const threadId: string | undefined = prefs.projectTelegramTopicId?.trim() || undefined;

  const text = buildProjectsSummaryMessage(projects, kanbanPhases, template);
  const result = await sendTelegramMessage(token, chatId, text, threadId);

  if (result.ok) {
    await adminDb
      .doc('settings/preferences')
      .set({ kanbanUpdateLastSentAt: new Date().toISOString() }, { merge: true });
  }

  return Response.json(result);
}
