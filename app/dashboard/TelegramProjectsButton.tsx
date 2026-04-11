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

const PHASE_KEYS: (keyof NonNullable<Project['phases']>)[] = [
  'filming',
  'roughCut',
  'draft',
  'master',
  'delivered',
];

function phasesDone(phases?: Project['phases']): number {
  if (!phases) return 0;
  return PHASE_KEYS.filter((k) => phases[k]).length;
}

function oneLiner(p: Project): string {
  const tl = getTimelineInfo(p.deliverDate);
  return tl ? `${tl.emoji} ${tl.label} — ${p.name}` : `▸ ${p.name}`;
}

const DIV = '━━━━━━━━━━━━━━━━━━━━━━━━';
const DIV_LIGHT = '──────────────────────';

function buildSummaryMessage(projects: Project[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isThisMonth = (d?: string) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth();
  };

  const sortByUrgency = (a: Project, b: Project) =>
    (getTimelineInfo(a.deliverDate)?.daysLeft ?? 9999) -
    (getTimelineInfo(b.deliverDate)?.daysLeft ?? 9999);

  const active = (p: Project) => p.status === 'confirmed' || p.status === 'in-progress';

  // Buckets
  const deliveredThisMonth = projects
    .filter((p) => p.status === 'completed' && isThisMonth(p.completedAt))
    .sort(sortByUrgency);

  const waitConfirm = projects.filter((p) => p.status === 'draft');

  const awaitFilming = projects.filter((p) => active(p) && !p.phases?.filming).sort(sortByUrgency);

  const awaitRoughCut = projects
    .filter((p) => active(p) && p.phases?.filming && !p.phases?.roughCut)
    .sort(sortByUrgency);

  const awaitDraft = projects
    .filter((p) => active(p) && p.phases?.roughCut && !p.phases?.draft)
    .sort(sortByUrgency);

  const awaitMaster = projects
    .filter((p) => active(p) && p.phases?.draft && !p.phases?.master)
    .sort(sortByUrgency);

  const awaitDeliver = projects
    .filter((p) => active(p) && p.phases?.master && !p.phases?.delivered)
    .sort(sortByUrgency);

  // Late counts across all active projects
  const allActive = [
    ...awaitFilming,
    ...awaitRoughCut,
    ...awaitDraft,
    ...awaitMaster,
    ...awaitDeliver,
  ];
  const veryLate = allActive.filter((p) => getTimelineInfo(p.deliverDate)?.isOverdue);
  const almostLate = allActive.filter((p) => {
    const tl = getTimelineInfo(p.deliverDate);
    return tl && !tl.isOverdue && tl.daysLeft <= 2;
  });

  const hasAny = deliveredThisMonth.length > 0 || waitConfirm.length > 0 || allActive.length > 0;

  if (!hasAny) {
    return `📊 PROJECT UPDATE — ${dateStr}\n\nNo active projects.`;
  }

  const ln: string[] = [];

  // ── Header ──────────────────────────────────────────────
  ln.push(`📊 PROJECT UPDATE — ${dateStr}`);
  ln.push('');
  const summary = [
    { emoji: '✅', label: 'Delivered this month', count: deliveredThisMonth.length },
    { emoji: '⬜', label: 'Unconfirmed', count: waitConfirm.length },
    { emoji: '🎬', label: 'Await Filming', count: awaitFilming.length },
    { emoji: '✂️', label: 'Await Rough Cut', count: awaitRoughCut.length },
    { emoji: '📝', label: 'Await Draft/VO', count: awaitDraft.length },
    { emoji: '🎯', label: 'Await Master', count: awaitMaster.length },
    { emoji: '🏁', label: 'Await Mark as Completed', count: awaitDeliver.length },
  ].filter((r) => r.count > 0);
  for (const r of summary) ln.push(`${r.emoji} ${r.count}  ${r.label}`);

  ln.push('');
  ln.push(DIV);

  // ── Delivered this month ─────────────────────────────────
  if (deliveredThisMonth.length > 0) {
    ln.push('');
    ln.push(`✅  Delivered this month (${deliveredThisMonth.length})`);
    for (const p of deliveredThisMonth) ln.push(`     — ${p.name}`);
    ln.push('');
    ln.push(DIV_LIGHT);
  }

  // ── Wait Project Confirm ─────────────────────────────────
  if (waitConfirm.length > 0) {
    ln.push('');
    ln.push(`⬜  Wait Project Confirm (${waitConfirm.length})`);
    for (const p of waitConfirm) ln.push(`     — ${p.name}`);
    ln.push('');
    ln.push(DIV_LIGHT);
  }

  // ── Phase sections ───────────────────────────────────────
  const phaseSections = [
    { emoji: '🎬', label: 'Await Filming', list: awaitFilming },
    { emoji: '✂️', label: 'Await Rough Cut', list: awaitRoughCut },
    { emoji: '📝', label: 'Await Draft/VO', list: awaitDraft },
    { emoji: '🎯', label: 'Await Master', list: awaitMaster },
    { emoji: '🏁', label: 'Await Mark as Completed', list: awaitDeliver },
  ].filter((s) => s.list.length > 0);

  for (let i = 0; i < phaseSections.length; i++) {
    const { emoji, label, list } = phaseSections[i];
    ln.push('');
    ln.push(`${emoji}  ${label} (${list.length})`);
    for (const p of list) ln.push(`     ${oneLiner(p)}`);
    if (i < phaseSections.length - 1) {
      ln.push('');
      ln.push(DIV_LIGHT);
    }
  }

  // ── Late summary ─────────────────────────────────────────
  if (veryLate.length > 0 || almostLate.length > 0) {
    ln.push('');
    ln.push(DIV);
    if (veryLate.length > 0)
      ln.push(`🔴  Very late: ${veryLate.length} project${veryLate.length > 1 ? 's' : ''}`);
    if (almostLate.length > 0)
      ln.push(
        `🟠  Almost late (≤2d): ${almostLate.length} project${almostLate.length > 1 ? 's' : ''}`
      );
  }

  return ln.join('\n');
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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      )}
    </button>
  );
}
