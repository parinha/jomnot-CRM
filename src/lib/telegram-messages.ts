/**
 * Telegram message builders — shared across API routes.
 * No external dependencies beyond types and constants.
 */

import type { Project } from '@/src/types';
import { DEFAULT_TELEGRAM_TEMPLATE } from '@/src/config/constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatConfirmedMonth(ym?: string): string | null {
  if (!ym) return null;
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatStatus(status: Project['status']): string {
  switch (status) {
    case 'unconfirmed':
      return 'Unconfirmed';
    case 'confirmed':
      return 'Confirmed';
    case 'on-hold':
      return 'On Hold';
    case 'completed':
      return 'Completed';
  }
}

export function getTimelineInfo(
  deliverDate: string | undefined,
  tl: typeof DEFAULT_TELEGRAM_TEMPLATE.timeline
) {
  if (!deliverDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliver = new Date(deliverDate);
  deliver.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((deliver.getTime() - today.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  let emoji: string;
  if (isOverdue || daysLeft === 0) emoji = tl.overdue;
  else if (daysLeft <= 3) emoji = tl.urgent;
  else if (daysLeft <= 10) emoji = tl.soon;
  else emoji = tl.ok;

  const label = isOverdue
    ? `${Math.abs(daysLeft)}d late`
    : daysLeft === 0
      ? 'due today'
      : `${daysLeft}d left`;

  return { daysLeft, isOverdue, label, emoji };
}

// ── New-project message ───────────────────────────────────────────────────────

export function buildNewProjectMessage(
  project: Project,
  totalActive: number,
  totalUnconfirmed: number
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const tl = DEFAULT_TELEGRAM_TEMPLATE.timeline;

  const ln: string[] = [];
  ln.push(`🆕 New Project Added — ${dateStr}`);
  ln.push('');
  ln.push(`📋  ${project.name}`);

  const monthLabel = formatConfirmedMonth(project.confirmedMonth);
  ln.push(`🏷  Status: ${formatStatus(project.status)}${monthLabel ? ` (${monthLabel})` : ''}`);

  if (project.filmingDate) {
    const d = new Date(project.filmingDate);
    ln.push(
      `📅  Filming: ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
    );
  }

  if (project.deliverDate) {
    const info = getTimelineInfo(project.deliverDate, tl);
    if (info) {
      const deliverStr = new Date(project.deliverDate).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      ln.push(`🗓  Deliver: ${deliverStr}  (${info.emoji} ${info.label})`);
    }
  }

  if (project.note?.trim()) {
    const note = project.note.trim();
    ln.push('');
    ln.push(`📝  Notes: ${note.length > 120 ? note.slice(0, 120) + '…' : note}`);
  }

  ln.push('');
  ln.push('━━━━━━━━━━━━');
  ln.push(`💼  Total active: ${totalActive}  |  ⏳ Unconfirmed: ${totalUnconfirmed}`);

  return ln.join('\n');
}

// ── Projects-summary message ──────────────────────────────────────────────────

export function buildProjectsSummaryMessage(projects: Project[]): string {
  const tl = DEFAULT_TELEGRAM_TEMPLATE.timeline;
  const { headerEmoji, headerTitle } = DEFAULT_TELEGRAM_TEMPLATE;

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
    (getTimelineInfo(a.deliverDate, tl)?.daysLeft ?? 9999) -
    (getTimelineInfo(b.deliverDate, tl)?.daysLeft ?? 9999);

  const confirmed = (p: Project) => p.status === 'confirmed';

  // Kanban columns — mirrors KanbanView.tsx getProjectCol logic
  const todo = projects
    .filter((p) => confirmed(p) && (!p.phases || !p.phases.filming))
    .sort(sortByUrgency);
  const filmed = projects
    .filter((p) => confirmed(p) && p.phases?.filming && !p.phases?.roughCut)
    .sort(sortByUrgency);
  const roughCut = projects
    .filter((p) => confirmed(p) && p.phases?.roughCut && !p.phases?.draft)
    .sort(sortByUrgency);
  const draftedVo = projects
    .filter((p) => confirmed(p) && p.phases?.draft && !p.phases?.master)
    .sort(sortByUrgency);
  const master = projects
    .filter((p) => confirmed(p) && p.phases?.master && !p.phases?.delivered)
    .sort(sortByUrgency);
  const done = projects.filter((p) => confirmed(p) && p.phases?.delivered).sort(sortByUrgency);
  const completed = projects
    .filter((p) => p.status === 'completed' && isThisMonth(p.completedAt))
    .sort(sortByUrgency);
  const waitConfirm = projects.filter((p) => p.status === 'unconfirmed');

  const allActive = [...todo, ...filmed, ...roughCut, ...draftedVo, ...master, ...done];
  const veryLate = allActive.filter((p) => getTimelineInfo(p.deliverDate, tl)?.isOverdue);
  const almostLate = allActive.filter((p) => {
    const i = getTimelineInfo(p.deliverDate, tl);
    return i && !i.isOverdue && i.daysLeft <= 2;
  });

  const hasAny = allActive.length > 0 || completed.length > 0 || waitConfirm.length > 0;
  if (!hasAny) return `${headerEmoji} ${headerTitle} — ${dateStr}\n\nNo active projects.`;

  const oneLiner = (p: Project): string => {
    const info = getTimelineInfo(p.deliverDate, tl);
    return info ? `${tl.noDate} ${p.name} (${info.emoji} ${info.label})` : `${tl.noDate} ${p.name}`;
  };

  const ln: string[] = [];
  ln.push(`${headerEmoji} ${headerTitle} — ${dateStr}`);
  ln.push('');

  // Summary counts
  const summaryRows = [
    { emoji: '🏁', label: 'Completed', list: completed },
    { emoji: '⬜', label: 'Wait Project Confirm', list: waitConfirm },
    { emoji: '⚪', label: 'Todo', list: todo },
    { emoji: '🎬', label: 'Filmed', list: filmed },
    { emoji: '✂️', label: 'Rough Cut', list: roughCut },
    { emoji: '📝', label: 'Drafted VO', list: draftedVo },
    { emoji: '🎯', label: 'Master', list: master },
    { emoji: '✅', label: 'Done', list: done },
  ].filter((r) => r.list.length > 0);

  for (const r of summaryRows) ln.push(`${r.emoji} ${r.list.length}  ${r.label}`);
  ln.push('');
  ln.push('━━━━━━━━━━━━');

  // Completed section (no timeline — already done)
  if (completed.length > 0) {
    ln.push('');
    ln.push(`🏁  Completed (${completed.length})`);
    for (const p of completed) ln.push(`     ▸ ${p.name}`);
  }

  // Wait confirm section (no timeline)
  if (waitConfirm.length > 0) {
    ln.push('');
    ln.push(`⬜  Wait Project Confirm (${waitConfirm.length})`);
    for (const p of waitConfirm) ln.push(`     ▸ ${p.name}`);
  }

  // Active phase sections
  const phaseSections = [
    { emoji: '⚪', label: 'Todo', list: todo },
    { emoji: '🎬', label: 'Filmed', list: filmed },
    { emoji: '✂️', label: 'Rough Cut', list: roughCut },
    { emoji: '📝', label: 'Drafted VO', list: draftedVo },
    { emoji: '🎯', label: 'Master', list: master },
    { emoji: '✅', label: 'Done', list: done },
  ].filter((s) => s.list.length > 0);

  for (const { emoji, label, list } of phaseSections) {
    ln.push('');
    ln.push(`${emoji}  ${label} (${list.length})`);
    for (const p of list) ln.push(`     ${oneLiner(p)}`);
  }

  if (veryLate.length > 0 || almostLate.length > 0) {
    ln.push('');
    ln.push('━━━━━━━━━━━━');
    if (veryLate.length > 0)
      ln.push(`Late: ${veryLate.length} project${veryLate.length > 1 ? 's' : ''}.`);
    if (almostLate.length > 0)
      ln.push(`Due Soon (≤2d): ${almostLate.length} project${almostLate.length > 1 ? 's' : ''}.`);
  }

  return ln.join('\n');
}

// ── Telegram sender ───────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  threadId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('text', text);
    formData.append('parse_mode', 'Markdown');
    if (threadId) formData.append('message_thread_id', threadId);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.description ?? res.statusText };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
