'use client';

import { useState } from 'react';
import { useStore, type Project } from './AppStore';

function getTimelineInfo(deliverDate?: string): {
  daysLeft: number;
  isOverdue: boolean;
  label: string;
  emoji: string;
} | null {
  if (!deliverDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliver = new Date(deliverDate);
  deliver.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((deliver.getTime() - today.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  let emoji: string;
  if (isOverdue || daysLeft === 0) emoji = '🔴';
  else if (daysLeft <= 3) emoji = '🟠';
  else if (daysLeft <= 10) emoji = '🟡';
  else emoji = '🟢';

  const label = isOverdue
    ? `${Math.abs(daysLeft)}d late`
    : daysLeft === 0
      ? 'due today'
      : `${daysLeft}d left`;

  return { daysLeft, isOverdue, label, emoji };
}

function buildSummaryMessage(projects: Project[]): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Exclude completed projects
  const active = projects.filter((p) => p.status === 'in-progress' || p.status === 'confirmed');
  const onHold = projects.filter((p) => p.status === 'on-hold');
  const quoted = projects.filter((p) => p.status === 'draft');

  // Sort active by urgency: overdue first, then fewest days left
  const sortByUrgency = (a: Project, b: Project) => {
    const ta = getTimelineInfo(a.deliverDate);
    const tb = getTimelineInfo(b.deliverDate);
    const da = ta ? ta.daysLeft : 9999;
    const db2 = tb ? tb.daysLeft : 9999;
    return da - db2;
  };
  active.sort(sortByUrgency);

  const lines: string[] = [`📊 *PROJECT UPDATE — ${dateStr}*`];

  if (active.length === 0 && onHold.length === 0 && quoted.length === 0) {
    lines.push('\n_No active projects._');
    return lines.join('\n');
  }

  if (active.length > 0) {
    lines.push(`\n🎬 *ACTIVE (${active.length})*`);
    for (const p of active) {
      const tl = getTimelineInfo(p.deliverDate);
      const timelinePart = tl ? ` — ${tl.emoji} ${tl.label}` : '';
      lines.push(`• ${p.name}${timelinePart}`);
    }
  }

  if (onHold.length > 0) {
    lines.push(`\n⏸ *ON HOLD (${onHold.length})*`);
    for (const p of onHold) {
      const tl = getTimelineInfo(p.deliverDate);
      const timelinePart = tl ? ` — ${tl.emoji} ${tl.label}` : '';
      lines.push(`• ${p.name}${timelinePart}`);
    }
  }

  if (quoted.length > 0) {
    lines.push(`\n📄 *QUOTED (${quoted.length})*`);
    for (const p of quoted) {
      lines.push(`• ${p.name}`);
    }
  }

  return lines.join('\n');
}

export default function TelegramProjectsButton() {
  const { projects, paymentInfo } = useStore();
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const token = paymentInfo.telegramBotToken?.trim();
    const chatId = paymentInfo.projectTelegramChatId?.trim();
    if (!token || !chatId) {
      alert('Add your Telegram Bot Token and Project Chat ID in Settings first.');
      return;
    }
    setSending(true);
    try {
      const text = buildSummaryMessage(projects);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('text', text);
      formData.append('parse_mode', 'Markdown');
      if (paymentInfo.projectTelegramTopicId?.trim()) {
        formData.append('message_thread_id', paymentInfo.projectTelegramTopicId.trim());
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Telegram error: ${err.description ?? res.statusText}`);
      }
    } catch (e) {
      alert(`Failed to send: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending}
      title="Send project status to Telegram"
      className="flex items-center justify-center w-10 h-10 rounded-xl text-sky-400/70 hover:text-sky-300 hover:bg-sky-500/15 active:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {sending ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        // Telegram paper-plane icon
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      )}
    </button>
  );
}
