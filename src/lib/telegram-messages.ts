/**
 * Telegram message builders — shared across API routes.
 * No external dependencies beyond types and constants.
 */

import type { Project, KanbanPhase, TelegramKanbanTemplate } from '@/src/types';
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

export function buildProjectsSummaryMessage(
  projects: Project[],
  kanbanPhases: KanbanPhase[] = [],
  tmpl?: TelegramKanbanTemplate
): string {
  const D = DEFAULT_TELEGRAM_TEMPLATE;
  const headerEmoji = tmpl?.headerEmoji ?? D.headerEmoji;
  const headerTitle = tmpl?.headerTitle ?? D.headerTitle;

  // Phase order: stored IDs (filtered to valid) + any new phases appended
  const allPhaseIds = kanbanPhases.map((p) => p.id);
  const stored = (tmpl?.sectionOrder ?? []).filter((id) => allPhaseIds.includes(id));
  const missingPhases = allPhaseIds.filter((id) => !stored.includes(id));
  const phaseOrder = stored.length > 0 ? [...stored, ...missingPhases] : allPhaseIds;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Use timeline info only for urgency sorting, not display
  const tl = D.timeline;
  const sortByUrgency = (a: Project, b: Project) =>
    (getTimelineInfo(a.deliverDate, tl)?.daysLeft ?? 9999) -
    (getTimelineInfo(b.deliverDate, tl)?.daysLeft ?? 9999);

  const firstPhaseId = kanbanPhases[0]?.id ?? '';
  const getPhaseId = (p: Project): string => {
    if (!p.kanbanPhase) return firstPhaseId;
    return kanbanPhases.some((ph) => ph.id === p.kanbanPhase) ? p.kanbanPhase : firstPhaseId;
  };

  const phaseMap = new Map(
    kanbanPhases.map((phase) => [
      phase.id,
      {
        phase,
        list: projects
          .filter((p) => p.status === 'confirmed' && getPhaseId(p) === phase.id)
          .sort(sortByUrgency),
      },
    ])
  );

  const allActive = [...phaseMap.values()].flatMap((b) => b.list);
  if (allActive.length === 0)
    return `${headerEmoji} ${headerTitle} — ${dateStr}\n\nNo active projects.`;

  const ln: string[] = [];
  ln.push(`${headerEmoji} ${headerTitle} — ${dateStr}`);
  ln.push('');

  // Summary count rows — phases only, in order
  for (const id of phaseOrder) {
    const b = phaseMap.get(id);
    if (b && b.list.length > 0) ln.push(`▸ ${b.list.length}  ${b.phase.label}`);
  }
  ln.push('');
  ln.push('━━━━━━━━━━━━');

  // Detail sections — phases in user-defined order
  for (const id of phaseOrder) {
    const b = phaseMap.get(id);
    if (b && b.list.length > 0) {
      ln.push('');
      ln.push(`■ ${b.phase.label}:`);
      for (const p of b.list) {
        ln.push(`  ▸ ${p.name}`);
        for (const item of p.items ?? []) {
          ln.push(`    - ${item.description}`);
        }
      }
    }
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
