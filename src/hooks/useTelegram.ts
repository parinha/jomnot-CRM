'use client';

import { useProjects } from './useProjects';
import { usePaymentInfo } from './useSettings';
import { useAppPreferences } from './useAppPreferences';
import { buildProjectsSummaryMessage, sendTelegramMessage } from '@/src/lib/telegram-messages';

export function useSendProjectsTelegram() {
  const { data: projects } = useProjects();
  const { data: paymentInfo } = usePaymentInfo();
  const prefs = useAppPreferences();

  async function sendAll(): Promise<{ ok: boolean; error?: string }> {
    const token = paymentInfo?.telegramBotToken?.trim();
    const chatId = paymentInfo?.projectTelegramChatId?.trim();
    if (!token || !chatId) {
      return {
        ok: false,
        error: 'Add your Telegram Bot Token and Project Chat ID in Settings first.',
      };
    }
    const text = buildProjectsSummaryMessage(
      projects,
      prefs.kanbanPhases,
      paymentInfo?.telegramTemplate
    );
    return sendTelegramMessage(token, chatId, text, paymentInfo?.projectTelegramTopicId?.trim());
  }

  return { sendAll };
}
